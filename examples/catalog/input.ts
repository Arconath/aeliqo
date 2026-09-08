import {
  AeliqoCheckboxElement,
  AeliqoComboboxElement,
  AeliqoDateFieldElement,
  AeliqoDateRangeElement,
  AeliqoFieldGroupElement,
  AeliqoFileInputElement,
  AeliqoFormElement,
  AeliqoNumberFieldElement,
  AeliqoRadioGroupElement,
  AeliqoSearchFieldElement,
  AeliqoSelectElement,
  AeliqoSliderElement,
  AeliqoSwitchElement,
  AeliqoTextAreaElement,
  AeliqoTextFieldElement,
  type AeliqoOption,
} from "@aeliqo/web";
import {cleanupCatalogRoot, createCatalogElement, createCatalogRoot} from "./fixture.js";
import type {CatalogExampleDefinition, CatalogExampleId} from "./types.js";

const options: readonly AeliqoOption[] = [
  {value: "ada", label: "Ada Lovelace", description: "Research"},
  {value: "grace", label: "Grace Hopper", description: "Product"},
  {value: "lin", label: "Lin Chen", disabled: true},
];

const mount = (id: CatalogExampleId, fn: (root: HTMLElement) => void): CatalogExampleDefinition => ({
  metadata: {
    id,
    name: id.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()),
    family: "input",
    description: "A native-first form control with explicit value, validation, and draft semantics.",
    fixture: "A standalone control mounted into a host-owned form surface; no agent, Studio, or remote data is required.",
    props: ["label", "name", "value", "required", "disabled", "validationState"],
    propsNotes: "Value and draft props are explicit; the host remains responsible for validation authority and submit effects.",
    states: ["ready", "disabled", "read-only", "invalid", "pending"],
    keyboard: ["Tab", "native control keys", "Enter commits where applicable", "IME composition is preserved"],
    events: ["aeliqo-input-change", "aeliqo-input-commit", "aeliqo-validation"],
    expectedOutcome: "The control renders with an explicit label and leaves authoritative validation and submission with the host.",
    source: `import {registerAeliqoElements} from "@aeliqo/web";\nregisterAeliqoElements();\n\n${fn.toString()}`,
  },
  mount(container) {
    const root = createCatalogRoot(container);
    fn(root);
    return cleanupCatalogRoot(root);
  },
});

export const inputExamples: readonly CatalogExampleDefinition[] = [
  mount("text-field", (root) => {
    const element = createCatalogElement<AeliqoTextFieldElement>("aeliqo-text-field", root);
    element.label = "Display name";
    element.name = "displayName";
    element.value = "Ada Lovelace";
    element.description = "Used in the report header.";
    element.autocomplete = "name";
  }),
  mount("text-area", (root) => {
    const element = createCatalogElement<AeliqoTextAreaElement>("aeliqo-text-area", root);
    element.label = "Notes";
    element.name = "notes";
    element.defaultValue = "Draft notes";
    element.rows = 4;
    element.spellcheck = true;
  }),
  mount("number-field", (root) => {
    const element = createCatalogElement<AeliqoNumberFieldElement>("aeliqo-number-field", root);
    element.label = "Amount";
    element.name = "amount";
    element.locale = "en-US";
    element.text = "1,234.50";
    element.value = "1234.50";
    element.unit = "USD";
    element.min = "0";
  }),
  mount("checkbox", (root) => {
    const element = createCatalogElement<AeliqoCheckboxElement>("aeliqo-checkbox", root);
    element.label = "Include archived records";
    element.name = "includeArchived";
    element.value = "yes";
    element.checked = false;
  }),
  mount("radio-group", (root) => {
    const element = createCatalogElement<AeliqoRadioGroupElement>("aeliqo-radio-group", root);
    element.label = "Report owner";
    element.name = "owner";
    element.options = options;
    element.value = "ada";
    element.orientation = "vertical";
  }),
  mount("switch", (root) => {
    const element = createCatalogElement<AeliqoSwitchElement>("aeliqo-switch", root);
    element.label = "Live updates";
    element.name = "live";
    element.checked = true;
  }),
  mount("select", (root) => {
    const element = createCatalogElement<AeliqoSelectElement>("aeliqo-select", root);
    element.label = "Team";
    element.name = "team";
    element.options = options.map(({value, label}) => ({value, label}));
    element.value = "ada";
    element.emptyLabel = "Choose a team";
  }),
  mount("combobox", (root) => {
    const element = createCatalogElement<AeliqoComboboxElement>("aeliqo-combobox", root);
    element.label = "Person";
    element.name = "person";
    element.options = options;
    element.value = "ada";
    element.query = "Ada";
    element.open = true;
    element.minQueryLength = 1;
  }),
  mount("date-field", (root) => {
    const element = createCatalogElement<AeliqoDateFieldElement>("aeliqo-date-field", root);
    element.label = "Report date";
    element.name = "reportDate";
    element.value = "2026-09-09";
    element.min = "2026-01-01";
    element.max = "2026-12-31";
    element.calendar = "gregory";
  }),
  mount("date-range", (root) => {
    const element = createCatalogElement<AeliqoDateRangeElement>("aeliqo-date-range", root);
    element.label = "Reporting period";
    element.name = "period";
    element.start = "2026-09-01";
    element.end = "2026-09-30";
    element.boundary = "inclusive";
    element.timezone = "calendar";
  }),
  mount("slider", (root) => {
    const element = createCatalogElement<AeliqoSliderElement>("aeliqo-slider", root);
    element.label = "Confidence";
    element.name = "confidence";
    element.min = 0;
    element.max = 100;
    element.step = 5;
    element.value = 75;
    element.unit = "%";
  }),
  mount("search-field", (root) => {
    const element = createCatalogElement<AeliqoSearchFieldElement>("aeliqo-search-field", root);
    element.label = "Search reports";
    element.name = "query";
    element.value = "retention";
    element.queryOnInput = true;
    element.debounceMs = 150;
    element.placeholder = "Search by name";
  }),
  mount("file-input", (root) => {
    const element = createCatalogElement<AeliqoFileInputElement>("aeliqo-file-input", root);
    element.label = "Evidence file";
    element.name = "evidence";
    element.accept = ".csv,text/csv";
    element.multiple = false;
    element.maxFiles = 1;
    element.maxBytes = 2_000_000;
  }),
  mount("field-group", (root) => {
    const group = createCatalogElement<AeliqoFieldGroupElement>("aeliqo-field-group", root);
    group.legend = "Profile details";
    group.description = "All fields are validated together.";
    const field = document.createElement("aeliqo-text-field") as AeliqoTextFieldElement;
    field.label = "Preferred name";
    field.name = "preferredName";
    group.append(field);
  }),
  mount("form", (root) => {
    const form = createCatalogElement<AeliqoFormElement>("aeliqo-form", root);
    form.label = "Report filters";
    const field = document.createElement("aeliqo-text-field") as AeliqoTextFieldElement;
    field.label = "Required filter";
    field.name = "filter";
    field.required = true;
    const submit = document.createElement("button");
    submit.type = "submit";
    submit.textContent = "Apply";
    form.append(field, submit);
  }),
];
