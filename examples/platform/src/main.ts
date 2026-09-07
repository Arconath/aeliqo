import "./csp-bootstrap.js";
import {
  AeliqoChartElement,
  AeliqoInputElement,
  AeliqoInputEvent,
  AeliqoTableElement,
  registerAeliqoElements,
} from "@aeliqo/web";

registerAeliqoElements();

const form = document.querySelector<HTMLFormElement>("#standalone-form");
const input = document.querySelector<AeliqoInputElement>("#standalone-form aeliqo-input");
const table = document.querySelector<AeliqoTableElement>("#standalone-table");
const chart = document.querySelector<AeliqoChartElement>("#standalone-chart");
const status = document.querySelector<HTMLElement>("#standalone-status");

if (form === null || input === null || table === null || chart === null || status === null) {
  throw new Error("The vanilla platform fixture markup is incomplete.");
}

table.caption = "People";
table.columns = [
  {key: "name", label: "Name"},
  {key: "role", label: "Role"},
];
table.rows = [
  {name: "Ada", role: "Engineer"},
  {name: "Grace", role: "Researcher"},
];

chart.title = "Weekly activity";
chart.summary = "A small, accessible trend example.";
chart.unit = "events";
chart.points = [
  {label: "Mon", value: 3},
  {label: "Tue", value: 5},
  {label: "Wed", value: 4},
];

input.addEventListener("aeliqo-input", (event: Event) => {
  if (!(event instanceof AeliqoInputEvent)) {
    return;
  }
  input.value = event.detail.value;
  status.textContent = `Draft: ${event.detail.value}`;
});

form.addEventListener("submit", (event: SubmitEvent) => {
  event.preventDefault();
  const submitted = new FormData(form).get("person");
  status.textContent = `Submitted: ${typeof submitted === "string" ? submitted : ""}`;
});
