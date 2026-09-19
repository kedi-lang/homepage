"""Execute the displayed programs with deterministic model/SDK responses."""

import json
from pathlib import Path

import pytest
from pydantic_ai.messages import ModelResponse, ToolCallPart, ToolReturnPart
from pydantic_ai.models.function import FunctionModel
from typesafe_sdk import (
    Choice,
    ChoiceAnswer,
    Noul,
    NoulAnswer,
    Score,
    ScoreAnswer,
    SystemOneResponse,
    Usage,
)

from kedi.agent_adapter.adapters import PydanticAdapter
from kedi.lang import compile_program, parse_program
from kedi_typesafe.integrations.pydantic import TypeSafeModel
from tests.mock_adapter import AttrDict, MockAdapter


WEBSITE = Path(__file__).resolve().parents[1]
EXAMPLES = json.loads((WEBSITE / "src/data/examples.json").read_text())


def run_example(name, adapter):
    return compile_program(
        parse_program(EXAMPLES[name]["code"]),
        adapter=adapter,
        loop_iteration_limit=3,
    ).run_main()


@pytest.mark.parametrize("name", EXAMPLES)
def test_examples_compile(name):
    compile_program(parse_program(EXAMPLES[name]["code"]), adapter=MockAdapter())


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
        ("hello", {"owner": "Mira", "needs_approval": True}, "Mira"),
        ("python", {"seats": 12, "monthly_usd": 19.0}, 2736.0),
    ],
)
def test_template_values_flow_into_program(name, fields, expected):
    adapter = ExampleAdapter(lambda _: fields)
    assert run_example(name, adapter) == expected
    assert len(adapter.calls) == 1


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
    def __init__(self, *, urgency=1.6, probability=0.93):
        self.urgency = urgency
        self.probability = probability
        self.calls = []

    async def system_one(self, state, questions, *, model=None):
        self.calls.append((state, questions))
        answers = {}
        for key, question in questions.items():
            if isinstance(question, Choice):
                assert dict(question.criteria) == {
                    "billing": "Payments, refunds, and invoices",
                    "technical": "Broken software or access",
                }
                answers[key] = ChoiceAnswer(
                    choice="billing",
                    confidence=0.9,
                    probabilities={"billing": 0.9, "technical": 0.1},
                )
            elif isinstance(question, Score):
                assert list(question.criteria) == ["Routine", "Time-sensitive", "Blocked now"]
                answers[key] = ScoreAnswer(
                    score=self.urgency,
                    confidence=0.8,
                    legend=dict(enumerate(question.criteria)),
                    probabilities={0: 1 - self.urgency / 2, 1: 0, 2: self.urgency / 2},
                )
            else:
                assert isinstance(question, Noul)
                answers[key] = NoulAnswer(noul=self.probability)
        return SystemOneResponse(
            model="jev-test", usage=Usage(input_tokens=12, output_tokens=3), answers=answers
        )

    async def aclose(self):
        pass


@pytest.mark.parametrize(
    ("urgency", "probability", "expected"),
    [
        (1.6, 0.93, "priority"),
        (0.4, 0.2, "standard"),
        (1.5, 0.2, "priority"),
        (0.4, 0.8, "priority"),
    ],
)
def test_jev_routing_is_one_structured_request(monkeypatch, urgency, probability, expected):
    client = JevClient(urgency=urgency, probability=probability)
    model = TypeSafeModel(client=client)
    monkeypatch.setattr(PydanticAdapter, "_resolve_model", lambda self, name: model)
    assert run_example("jevRouting", PydanticAdapter(model)) == f"billing/{expected}"
    assert len(client.calls) == 1
    state, questions = client.calls[0]
    assert "I was charged twice" in str(state)
    assert {type(question) for question in questions.values()} == {Choice, Score, Noul}
    probability_question = next(q for q in questions.values() if isinstance(q, Noul))
    assert "cancel their subscription" in str(probability_question.criteria)


@pytest.mark.parametrize("probability", [0.96, 0.9, 0.2])
def test_draft_then_jev_review_and_threshold(monkeypatch, probability):
    draft_calls = []
    reply = "I can help check delivery before discussing a refund."

    def draft(messages, info):
        draft_calls.append(messages)
        return ModelResponse(parts=[ToolCallPart(info.output_tools[0].name, {"reply": reply})])

    generator = FunctionModel(draft)
    client = JevClient(probability=probability)
    judge = TypeSafeModel(client=client)

    def resolve(self, name):
        return {"google/gemini-3-flash-preview": generator, "typesafe/jev-latest": judge}[name]

    monkeypatch.setattr(PydanticAdapter, "_resolve_model", resolve)
    assert run_example("jev", PydanticAdapter(generator)) == (
        "ready for review" if probability > 0.9 else "needs review"
    )
    assert len(draft_calls) == len(client.calls) == 1
    assert reply in str(client.calls[0][0])


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
                    else ToolCallPart("read_changelog", {})
                ]
            )
        assert "account_id" in str(returns[-1].content)
        fields = (
            {"announcement": "v2.0 adds CSV exports and renames an API field.", "steps": steps}
            if parent
            else {
                "task_summary": "Read v2.0 and identified the API migration.",
                "final_result": {"changes": ["CSV exports"], "migration": steps},
            }
        )
        return ModelResponse(parts=[ToolCallPart(info.output_tools[0].name, fields)])

    model = FunctionModel(respond)
    monkeypatch.setattr(PydanticAdapter, "_resolve_model", lambda self, name: model)
    assert run_example("agent", PydanticAdapter(model)) == steps
    assert calls == ["editor", "researcher", "researcher", "editor"]
