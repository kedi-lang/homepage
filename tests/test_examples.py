"""Execute the displayed programs with deterministic model/SDK responses."""

import json
from pathlib import Path

import httpx
import pytest
from pydantic_ai.messages import ModelResponse, ToolCallPart, ToolReturnPart
from pydantic_ai.models.function import FunctionModel
from typesafe_sdk import (
    Choice,
    ChoiceAnswer,
    Noul,
    NoulAnswer,
    SystemOneResponse,
    Usage,
)

from kedi.agent_adapter.adapters import PydanticAdapter
from kedi.errors import KediExecutionError
from kedi.lang import compile_program, parse_program
from kedi_typesafe.integrations.pydantic import TypeSafeModel
from tests.mock_adapter import AttrDict, MockAdapter


WEBSITE = Path(__file__).resolve().parents[1]
EXAMPLES = json.loads((WEBSITE / "src/data/examples.json").read_text())


@pytest.fixture(autouse=True)
def movie_credentials(monkeypatch):
    monkeypatch.setenv("TMDB_API_KEY", "test-tmdb-token")


def run_example(name, adapter):
    return compile_program(
        parse_program(
            EXAMPLES[name]["code"],
            source_path=str(WEBSITE / "public/examples" / EXAMPLES[name]["filename"]),
        ),
        adapter=adapter,
        loop_iteration_limit=3,
    ).run_main()


@pytest.mark.parametrize("name", EXAMPLES)
def test_examples_compile(name):
    compile_program(
        parse_program(
            EXAMPLES[name]["code"],
            source_path=str(WEBSITE / "public/examples" / EXAMPLES[name]["filename"]),
        ),
        adapter=MockAdapter(),
    )


class ExampleAdapter(MockAdapter):
    def __init__(self, respond):
        super().__init__()
        self.respond = respond
        self.calls = []

    def produce_sync(self, *, template, **kwargs):
        self.calls.append(template)
        value = self.respond(template)
        return AttrDict(value) if isinstance(value, dict) else value


@pytest.mark.parametrize(
    ("name", "fields", "expected"),
    [
        ("hello", {"director": "Hayao Miyazaki", "year": 2001, "minutes": 125}, "Hayao Miyazaki"),
        ("python", {"seats": 12, "monthly_usd": 19.0}, 2736.0),
    ],
)
def test_template_values_flow_into_program(name, fields, expected):
    adapter = ExampleAdapter(lambda _: fields)
    assert run_example(name, adapter) == expected
    assert len(adapter.calls) == 1


@pytest.mark.parametrize("movie_id", [129, 987654])
def test_movie_details_flow_from_http_into_typed_bindings(monkeypatch, movie_id):
    calls = []

    def transport(request):
        assert request.url.host == "api.themoviedb.org"
        assert request.headers["Authorization"] == "Bearer test-tmdb-token"
        assert request.extensions["timeout"]["read"] == 10.0
        calls.append(request.url.path)
        if request.url.path == "/3/search/movie":
            assert request.url.params["query"] == "Spirited Away"
            return httpx.Response(
                200, json={"results": [{"id": movie_id, "title": "Spirited Away"}]}
            )
        assert request.url.path == f"/3/movie/{movie_id}"
        assert request.url.params["append_to_response"] == "credits"
        return httpx.Response(
            200,
            json={
                "title": "Spirited Away",
                "release_date": "2001-07-20",
                "runtime": 125,
                "credits": {"crew": [{"job": "Director", "name": "Hayao Miyazaki"}]},
            },
        )

    def respond(messages, info):
        returns = [
            part
            for message in messages
            for part in message.parts
            if isinstance(part, ToolReturnPart)
        ]
        if not returns:
            return ModelResponse(parts=[ToolCallPart("movie_details", {"title": "Spirited Away"})])
        assert "Hayao Miyazaki" in str(returns[-1].content)
        return ModelResponse(
            parts=[
                ToolCallPart(
                    info.output_tools[0].name,
                    {"director": "Hayao Miyazaki", "year": 2001, "minutes": 125},
                )
            ]
        )

    client_class = httpx.Client
    monkeypatch.setattr(
        httpx,
        "Client",
        lambda **kwargs: client_class(transport=httpx.MockTransport(transport), **kwargs),
    )
    assert run_example("hello", PydanticAdapter(FunctionModel(respond))) == "Hayao Miyazaki"
    assert calls == ["/3/search/movie", f"/3/movie/{movie_id}"]


@pytest.mark.parametrize("failure", [401, 404, 429, 500, "timeout", "invalid-json"])
@pytest.mark.parametrize("stage", ["search", "details"])
def test_movie_tool_propagates_http_errors(monkeypatch, failure, stage):
    def transport(request):
        if stage == "details" and request.url.path == "/3/search/movie":
            return httpx.Response(200, json={"results": [{"id": 456, "title": "Spirited Away"}]})
        if failure == "timeout":
            raise httpx.ReadTimeout("TMDB request timed out", request=request)
        if failure == "invalid-json":
            return httpx.Response(200, text="not JSON")
        return httpx.Response(failure, json={"status_message": "Request failed"})

    source = '> import: tmdb\n= <movie_details(`"Spirited Away"`)>'
    client_class = httpx.Client
    monkeypatch.setattr(
        httpx,
        "Client",
        lambda **kwargs: client_class(transport=httpx.MockTransport(transport), **kwargs),
    )
    with pytest.raises(KediExecutionError) as error:
        compile_program(
            parse_program(source, source_path=str(WEBSITE / "public/examples/movie_night.kedi")),
            adapter=MockAdapter(),
        ).run_main()
    assert "test-tmdb-token" not in str(error.value)
    if isinstance(failure, int):
        assert str(failure) in str(error.value)
    elif failure == "timeout":
        assert "TMDB request timed out" in str(error.value)
    else:
        assert "JSONDecodeError" in str(error.value)


@pytest.mark.parametrize(
    "results, pages, message",
    [
        ([], 1, "No movie found"),
        (
            [
                {"id": 1, "title": "Dune", "release_date": "1984-12-14"},
                {"id": 2, "title": "Dune", "release_date": "2021-09-15"},
            ],
            1,
            "Ambiguous title",
        ),
        ([{"id": 1, "title": "Dune"}], 2, "Ambiguous title"),
    ],
)
def test_movie_lookup_does_not_guess_when_search_is_inconclusive(
    monkeypatch, results, pages, message
):
    def transport(request):
        assert request.url.path == "/3/search/movie"
        return httpx.Response(200, json={"results": results, "total_pages": pages})

    client_class = httpx.Client
    monkeypatch.setattr(
        httpx,
        "Client",
        lambda **kwargs: client_class(transport=httpx.MockTransport(transport), **kwargs),
    )
    source = '> import: tmdb\n= <movie_details(`"Dune"`)>'
    with pytest.raises(KediExecutionError, match=message):
        compile_program(
            parse_program(source, source_path=str(WEBSITE / "public/examples/movie_night.kedi")),
            adapter=MockAdapter(),
        ).run_main()


def test_movie_lookup_can_disambiguate_by_year(monkeypatch):
    calls = []

    def transport(request):
        calls.append(request.url.path)
        if request.url.path == "/3/search/movie":
            assert request.url.params["query"] == "Dune"
            assert request.url.params["primary_release_year"] == "1984"
            return httpx.Response(200, json={"results": [{"id": 841, "title": "Dune"}]})
        assert request.url.path == "/3/movie/841"
        return httpx.Response(
            200,
            json={
                "title": "Dune",
                "release_date": "1984-12-14",
                "runtime": 137,
                "credits": {"crew": [{"job": "Director", "name": "David Lynch"}]},
            },
        )

    client_class = httpx.Client
    monkeypatch.setattr(
        httpx,
        "Client",
        lambda **kwargs: client_class(transport=httpx.MockTransport(transport), **kwargs),
    )
    source = '> import: tmdb\n= `movie_details("Dune", 1984)`'
    result = compile_program(
        parse_program(source, source_path=str(WEBSITE / "public/examples/movie_night.kedi")),
        adapter=MockAdapter(),
    ).run_main()
    assert result["directors"] == ["David Lynch"]
    assert calls == ["/3/search/movie", "/3/movie/841"]


@pytest.mark.parametrize("claim", [True, False])
def test_condition_updates_outer_binding(claim):
    assert run_example("condition", ExampleAdapter(lambda _: claim)) == (
        "migration" if claim else "standard"
    )


def test_loop_rechecks_revised_value():
    def respond(template):
        if "Claim:" in template:
            return "Export any report as CSV or PDF today." in template
        return {"revision": "CSV exports arrive Monday."}

    adapter = ExampleAdapter(respond)
    assert run_example("loop", adapter) == "CSV exports arrive Monday."
    assert len(adapter.calls) == 3
    assert "CSV exports arrive Monday." in adapter.calls[-1]


def test_map_uses_each_iterations_own_fields():
    def respond(template):
        is_bug = "CSV loses the last row." in template
        return {
            "is_bug": is_bug,
            "title": "CSV export drops the final row" if is_bug else "Dark theme",
        }

    adapter = ExampleAdapter(respond)
    assert run_example("map", adapter) == ["CSV export drops the final row"]
    assert len(adapter.calls) == 2


@pytest.mark.parametrize(
    ("name", "fields"),
    [
        ("template", {"action": {"owner": "Mira", "task": "Fix checkout", "blocked": True}}),
        ("procedure", {"brief": {"problem": "Coupon timeout", "next_step": "Reproduce it"}}),
    ],
)
def test_record_outputs_and_procedure_returns(name, fields):
    def respond(messages, info):
        return ModelResponse(parts=[ToolCallPart(info.output_tools[0].name, fields)])

    result = run_example(name, PydanticAdapter(FunctionModel(respond)))
    assert result.model_dump() == next(iter(fields.values()))


class JevClient:
    def __init__(self, *, queue="billing", probability=0.93):
        self.queue = queue
        self.probability = probability
        self.calls = []

    async def system_one(self, state, questions, *, model=None):
        self.calls.append((state, questions))
        answers = {}
        for key, question in questions.items():
            if isinstance(question, Choice):
                assert set(question.criteria) == {"billing", "technical"}
                answers[key] = ChoiceAnswer(
                    choice=self.queue,
                    confidence=0.9,
                    probabilities={
                        name: 0.9 if name == self.queue else 0.1 for name in question.criteria
                    },
                )
            else:
                assert isinstance(question, Noul)
                answers[key] = NoulAnswer(noul=self.probability)
        return SystemOneResponse(
            model="jev-test", usage=Usage(input_tokens=12, output_tokens=2), answers=answers
        )

    async def aclose(self):
        pass


@pytest.mark.parametrize(
    ("queue", "probability"),
    [
        ("billing", 0.93),
        ("technical", 0.2),
        ("billing", 0.79),
        ("billing", 0.8),
        ("technical", 0.0),
        ("technical", 1.0),
    ],
)
def test_jev_choices_and_probabilities_share_one_request(monkeypatch, queue, probability):
    client = JevClient(queue=queue, probability=probability)
    model = TypeSafeModel(client=client)
    monkeypatch.setattr(PydanticAdapter, "_resolve_model", lambda self, name: model)
    assert run_example("jev", PydanticAdapter(model)) == {
        "queue": queue,
        "priority": probability >= 0.8,
    }
    assert len(client.calls) == 1
    state, questions = client.calls[0]
    assert "I was charged twice" in str(state)
    assert len(questions) == 2
    assert {type(question) for question in questions.values()} == {Choice, Noul}


def test_stock_tool_reads_supplied_fixture(monkeypatch):
    monkeypatch.chdir(WEBSITE / "public/examples")
    calls = []

    def respond(messages, info):
        calls.append(messages)
        returns = [
            part
            for message in messages
            for part in message.parts
            if isinstance(part, ToolReturnPart)
        ]
        if not returns:
            return ModelResponse(parts=[ToolCallPart("stock", {"item": "field-notebook"})])
        assert returns[-1].content == 3
        return ModelResponse(
            parts=[ToolCallPart(info.output_tools[0].name, {"remaining": 3, "can_fulfill": False})]
        )

    assert run_example("tool", PydanticAdapter(FunctionModel(respond))) is False
    assert len(calls) == 2


def test_release_team_delegates_and_reads_changelog(monkeypatch):
    monkeypatch.chdir(WEBSITE / "public/examples")
    calls = []
    steps = ["Read account_id instead of user_id in API responses"]

    def respond(messages, info):
        tools = {tool.name for tool in info.function_tools}
        returns = [
            part
            for message in messages
            for part in message.parts
            if isinstance(part, ToolReturnPart)
        ]
        parent = "delegate_task" in tools
        calls.append("editor" if parent else "researcher")
        if not returns:
            return ModelResponse(
                parts=[
                    ToolCallPart(
                        "delegate_task",
                        {
                            "subagent": "researcher",
                            "task": "Read v2.0 and identify required migrations",
                        },
                    )
                    if parent
                    else ToolCallPart("read_text_file", {"file_path": "CHANGELOG.md"})
                ]
            )
        assert "account_id" in str(returns[-1].content)
        fields = (
            {"steps": steps}
            if parent
            else {
                "task_summary": "Read v2.0 and identified the API migration.",
                "final_result": steps,
            }
        )
        return ModelResponse(parts=[ToolCallPart(info.output_tools[0].name, fields)])

    model = FunctionModel(respond)
    monkeypatch.setattr(PydanticAdapter, "_resolve_model", lambda self, name: model)
    assert run_example("agent", PydanticAdapter(model)) == steps
    assert calls == ["editor", "researcher", "researcher", "editor"]
