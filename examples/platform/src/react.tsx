import "./csp-bootstrap.js";
import React, {useState} from "react";
import {createRoot} from "react-dom/client";
import {
  AeliqoChart,
  AeliqoInput,
  AeliqoTable,
  registerAeliqoReactElements,
} from "@aeliqo/react";

registerAeliqoReactElements();

function ReactFixture(): React.JSX.Element {
  const [value, setValue] = useState("React");
  return (
    <main>
      <h1>React platform fixture</h1>
      <p id="react-value" role="status">{value}</p>
      <form id="react-form">
        <AeliqoInput
          label="React name"
          value={value}
          name="person"
          onAeliqoInput={(event) => setValue(event.detail.value)}
        />
        <button type="submit">Submit</button>
      </form>
      <AeliqoTable
        caption="People"
        columns={[
          {key: "name", label: "Name"},
          {key: "role", label: "Role"},
        ]}
        rows={[
          {name: "Ada", role: "Engineer"},
          {name: "Grace", role: "Researcher"},
        ]}
      />
      <AeliqoChart
        title="Weekly activity"
        summary="A small, accessible trend example."
        unit="events"
        points={[
          {label: "Mon", value: 3},
          {label: "Tue", value: 5},
          {label: "Wed", value: 4},
        ]}
      />
    </main>
  );
}

const root = document.querySelector<HTMLDivElement>("#react-root");
if (root === null) {
  throw new Error("The React platform fixture root is missing.");
}
createRoot(root).render(<ReactFixture />);
