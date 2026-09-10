/**
 * Authored mount expressions used by the public catalog snippets.
 *
 * These strings are intentionally preserved as source data. They are not
 * derived from a runtime function (whose name bindings can be renamed by a
 * production minifier), so a docs/site bundle can expose them unchanged.
 */
import type {CatalogExampleId} from "./types.js";

export const CATALOG_MOUNT_SOURCES = {
  "button": String.raw`((root) => {
		const element = createCatalogElement<AeliqoButtonElement>("aeliqo-button", root);
		element.label = "Save report";
		element.variant = "solid";
		element.type = "button";
	})`,
  "icon-button": String.raw`((root) => {
		const element = createCatalogElement<AeliqoIconButtonElement>("aeliqo-icon-button", root);
		element.label = "Open details";
		appendSlottedText(element, "icon", "⋯");
	})`,
  "link": String.raw`((root) => {
		const element = createCatalogElement<AeliqoLinkElement>("aeliqo-link", root);
		element.label = "View report";
		element.href = "/reports/weekly";
		element.target = "_self";
	})`,
  "text": String.raw`((root) => {
		const element = createCatalogElement<AeliqoTextElement>("aeliqo-text", root);
		element.text = "A plain, trusted text value.";
		element.as = "p";
	})`,
  "heading": String.raw`((root) => {
		const element = createCatalogElement<AeliqoHeadingElement>("aeliqo-heading", root);
		element.level = 2;
		element.size = "heading";
		element.text = "Weekly report";
	})`,
  "badge": String.raw`((root) => {
		const element = createCatalogElement<AeliqoBadgeElement>("aeliqo-badge", root);
		element.text = "Ready";
		element.tone = "success";
	})`,
  "avatar": String.raw`((root) => {
		const element = createCatalogElement<AeliqoAvatarElement>("aeliqo-avatar", root);
		element.name = "Ada Lovelace";
		element.alt = "Ada Lovelace";
		element.size = "medium";
	})`,
  "separator": String.raw`((root) => {
		const element = createCatalogElement<AeliqoSeparatorElement>("aeliqo-separator", root);
		element.orientation = "horizontal";
	})`,
  "surface": String.raw`((root) => {
		const element = createCatalogElement<AeliqoSurfaceElement>("aeliqo-surface", root);
		element.as = "section";
		element.tone = "surface";
		element.label = "Report panel";
		element.textContent = "Bounded surface content";
	})`,
  "stack": String.raw`((root) => {
		const element = createCatalogElement<AeliqoStackElement>("aeliqo-stack", root);
		element.direction = "row";
		element.gap = 12;
		element.align = "center";
		for (const text of ["First", "Second"]) {
			const item = document.createElement("span");
			item.textContent = text;
			element.append(item);
		}
	})`,
  "grid": String.raw`((root) => {
		const element = createCatalogElement<AeliqoGridElement>("aeliqo-grid", root);
		element.columns = 2;
		element.gap = 16;
		element.minItem = "small";
		for (const text of ["Left", "Right"]) {
			const item = document.createElement("span");
			item.textContent = text;
			element.append(item);
		}
	})`,
  "split-pane": String.raw`((root) => {
		const element = createCatalogElement<AeliqoSplitPaneElement>("aeliqo-split-pane", root);
		element.defaultPosition = 42;
		element.min = 20;
		element.max = 80;
		element.primaryLabel = "Primary panel";
		element.secondaryLabel = "Secondary panel";
		appendSlottedText(element, "start", "Primary panel");
		appendSlottedText(element, "end", "Secondary panel");
	})`,
  "scroll-area": String.raw`((root) => {
		const element = createCatalogElement<AeliqoScrollAreaElement>("aeliqo-scroll-area", root);
		element.axis = "y";
		element.label = "Report rows";
		element.tabIndex = 0;
		const content = document.createElement("p");
		content.textContent = "Scrollable report content that retains focus visibility.";
		element.append(content);
	})`,
  "text-field": String.raw`((root) => {
		const element = createCatalogElement<AeliqoTextFieldElement>("aeliqo-text-field", root);
		element.label = "Display name";
		element.name = "displayName";
		element.value = "Ada Lovelace";
		element.description = "Used in the report header.";
		element.autocomplete = "name";
	})`,
  "text-area": String.raw`((root) => {
		const element = createCatalogElement<AeliqoTextAreaElement>("aeliqo-text-area", root);
		element.label = "Notes";
		element.name = "notes";
		element.defaultValue = "Draft notes";
		element.rows = 4;
		element.spellcheck = true;
	})`,
  "number-field": String.raw`((root) => {
		const element = createCatalogElement<AeliqoNumberFieldElement>("aeliqo-number-field", root);
		element.label = "Amount";
		element.name = "amount";
		element.locale = "en-US";
		element.text = "1,234.50";
		element.value = "1234.50";
		element.unit = "USD";
		element.min = "0";
	})`,
  "checkbox": String.raw`((root) => {
		const element = createCatalogElement<AeliqoCheckboxElement>("aeliqo-checkbox", root);
		element.label = "Include archived records";
		element.name = "includeArchived";
		element.value = "yes";
		element.checked = false;
	})`,
  "radio-group": String.raw`((root) => {
		const element = createCatalogElement<AeliqoRadioGroupElement>("aeliqo-radio-group", root);
		element.label = "Report owner";
		element.name = "owner";
		element.options = options;
		element.value = "ada";
		element.orientation = "vertical";
	})`,
  "switch": String.raw`((root) => {
		const element = createCatalogElement<AeliqoSwitchElement>("aeliqo-switch", root);
		element.label = "Live updates";
		element.name = "live";
		element.checked = true;
	})`,
  "select": String.raw`((root) => {
		const element = createCatalogElement<AeliqoSelectElement>("aeliqo-select", root);
		element.label = "Team";
		element.name = "team";
		element.options = [
			{ value: "research", label: "Research" },
			{ value: "product", label: "Product" }
		];
		element.value = "research";
		element.emptyLabel = "Choose a team";
	})`,
  "combobox": String.raw`((root) => {
		const element = createCatalogElement<AeliqoComboboxElement>("aeliqo-combobox", root);
		element.label = "Person";
		element.name = "person";
		element.options = options;
		element.value = "ada";
		element.query = "Ada";
		element.open = true;
		element.minQueryLength = 1;
	})`,
  "date-field": String.raw`((root) => {
		const element = createCatalogElement<AeliqoDateFieldElement>("aeliqo-date-field", root);
		element.label = "Report date";
		element.name = "reportDate";
		element.value = "2026-09-09";
		element.min = "2026-01-01";
		element.max = "2026-12-31";
		element.calendar = "gregory";
	})`,
  "date-range": String.raw`((root) => {
		const element = createCatalogElement<AeliqoDateRangeElement>("aeliqo-date-range", root);
		element.label = "Reporting period";
		element.name = "period";
		element.start = "2026-09-01";
		element.end = "2026-09-30";
		element.boundary = "inclusive";
		element.timezone = "calendar";
	})`,
  "slider": String.raw`((root) => {
		const element = createCatalogElement<AeliqoSliderElement>("aeliqo-slider", root);
		element.label = "Confidence";
		element.name = "confidence";
		element.min = 0;
		element.max = 100;
		element.step = 5;
		element.value = 75;
		element.unit = "%";
	})`,
  "search-field": String.raw`((root) => {
		const element = createCatalogElement<AeliqoSearchFieldElement>("aeliqo-search-field", root);
		element.label = "Search reports";
		element.name = "query";
		element.value = "retention";
		element.queryOnInput = true;
		element.debounceMs = 150;
		element.placeholder = "Search by name";
	})`,
  "file-input": String.raw`((root) => {
		const element = createCatalogElement<AeliqoFileInputElement>("aeliqo-file-input", root);
		element.label = "Evidence file";
		element.name = "evidence";
		element.accept = ".csv,text/csv";
		element.multiple = false;
		element.maxFiles = 1;
		element.maxBytes = 2e6;
	})`,
  "field-group": String.raw`((root) => {
		const group = createCatalogElement<AeliqoFieldGroupElement>("aeliqo-field-group", root);
		group.legend = "Profile details";
		group.description = "All fields are validated together.";
		const field = document.createElement("aeliqo-text-field") as AeliqoTextFieldElement;
		field.label = "Preferred name";
		field.name = "preferredName";
		group.append(field);
	})`,
  "form": String.raw`((root) => {
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
	})`,
  "tabs": String.raw`((root) => {
		const element = createCatalogElement<AeliqoTabsElement>("aeliqo-tabs", root);
		element.items = tabs;
		element.value = "overview";
		element.activation = "manual";
	})`,
  "breadcrumb": String.raw`((root) => {
		const element = createCatalogElement<AeliqoBreadcrumbElement>("aeliqo-breadcrumb", root);
		element.items = breadcrumb;
		element.label = "Report path";
	})`,
  "pagination": String.raw`((root) => {
		const element = createCatalogElement<AeliqoPaginationElement>("aeliqo-pagination", root);
		element.page = 2;
		element.pageCount = 4;
		element.hasPrevious = true;
		element.hasNext = true;
		element.label = "Report pages";
	})`,
  "menu": String.raw`((root) => {
		const element = createCatalogElement<AeliqoMenuElement>("aeliqo-menu", root);
		element.items = menuItems;
		element.label = "Report actions";
		element.open = true;
	})`,
  "tree-nav": String.raw`((root) => {
		const element = createCatalogElement<AeliqoTreeNavElement>("aeliqo-tree-nav", root);
		element.nodes = treeNodes;
		element.expandedIds = ["reports"];
		element.selectedId = "weekly";
		element.label = "Report navigation";
	})`,
  "tooltip": String.raw`((root) => {
		const element = createCatalogElement<AeliqoTooltipElement>("aeliqo-tooltip", root);
		element.label = "More information";
		element.content = "Values are scoped to the current report.";
		element.open = true;
	})`,
  "popover": String.raw`((root) => {
		const element = createCatalogElement<AeliqoPopoverElement>("aeliqo-popover", root);
		element.label = "Report details";
		element.content = "The report includes the authorized current scope.";
		element.open = true;
		element.modal = false;
	})`,
  "dialog": String.raw`((root) => {
		const element = createCatalogElement<AeliqoDialogElement>("aeliqo-dialog", root);
		element.heading = "Confirm archive";
		element.open = true;
		element.modal = true;
		element.closeOnEscape = true;
		const action = document.createElement("button");
		action.type = "button";
		action.textContent = "Archive report";
		element.append(action);
	})`,
  "drawer": String.raw`((root) => {
		const element = createCatalogElement<AeliqoDrawerElement>("aeliqo-drawer", root);
		element.heading = "Report details";
		element.mode = "inline";
		element.side = "end";
		element.open = true;
		element.textContent = "Inline detail content keeps the surrounding task visible.";
	})`,
  "toast": String.raw`((root) => {
		const element = createCatalogElement<AeliqoToastElement>("aeliqo-toast", root);
		element.message = "Report saved";
		element.tone = "success";
		element.open = true;
		element.duration = 0;
		element.dismissible = true;
	})`,
  "alert": String.raw`((root) => {
		const element = createCatalogElement<AeliqoAlertElement>("aeliqo-alert", root);
		element.heading = "Review scope";
		element.message = "This page contains the first authorized result window.";
		element.tone = "warning";
		element.actionLabel = "Inspect";
		element.dismissible = true;
		element.open = true;
	})`,
  "progress": String.raw`((root) => {
		const element = createCatalogElement<AeliqoProgressElement>("aeliqo-progress", root);
		element.label = "Loading report";
		element.value = 62;
		element.max = 100;
	})`,
  "skeleton": String.raw`((root) => {
		const element = createCatalogElement<AeliqoSkeletonElement>("aeliqo-skeleton", root);
		element.label = "Loading report rows";
		element.lines = 3;
		element.variant = "text";
		element.animated = false;
	})`,
  "empty-state": String.raw`((root) => {
		const element = createCatalogElement<AeliqoEmptyStateElement>("aeliqo-empty-state", root);
		element.kind = "no-matches";
		element.heading = "No matching reports";
		element.message = "Try a broader team or date filter.";
		element.actionLabel = "Clear filters";
	})`,
  "metric": String.raw`((root) => {
		const element = createCatalogElement<AeliqoMetricElement>("aeliqo-metric", root);
		element.label = "Authorized people";
		element.value = catalogRows.length;
		element.unit = "records";
		element.scope = catalogScope;
		element.description = "Current filtered result";
	})`,
  "delta": String.raw`((root) => {
		const element = createCatalogElement<AeliqoDeltaElement>("aeliqo-delta", root);
		element.label = "Change from last week";
		element.current = .62;
		element.baseline = .5;
		element.mode = "percentage-point";
		element.unit = "%";
		element.scope = catalogScope;
	})`,
  "key-value": String.raw`((root) => {
		const element = createCatalogElement<AeliqoKeyValueElement>("aeliqo-key-value", root);
		const items = [{
			key: "owner",
			label: "Owner",
			value: "Ada Lovelace"
		}, {
			key: "scope",
			label: "Scope",
			value: "Authorized people",
			description: "Current report scope"
		}];
		element.items = items;
		element.scope = catalogScope;
	})`,
  "detail": String.raw`((root) => {
		const element = createCatalogElement<AeliqoDetailElement>("aeliqo-detail", root);
		element.title = "Person detail";
		element.record = catalogRows[0];
		element.fields = catalogColumns;
		element.identity = ["id"];
		element.entity = "person";
		element.scope = catalogScope;
	})`,
  "record-list": String.raw`((root) => {
		const element = createCatalogElement<AeliqoRecordListElement>("aeliqo-record-list", root);
		element.title = "People";
		element.rows = catalogRows;
		element.columns = catalogColumns;
		element.identity = ["id"];
		element.entity = "person";
		element.selection = "single";
		element.selectedKeys = [personKeys[0]];
		element.result = catalogRef;
		element.scope = catalogScope;
	})`,
  "card-collection": String.raw`((root) => {
		const element = createCatalogElement<AeliqoCardCollectionElement>("aeliqo-card-collection", root);
		element.title = "People cards";
		element.rows = catalogRows;
		element.columns = catalogColumns;
		element.identity = ["id"];
		element.entity = "person";
		element.headingKey = "name";
		element.selection = "multiple";
		element.hasMore = true;
		element.loadingMore = false;
		element.scope = catalogScope;
	})`,
  "table": String.raw`((root) => {
		const element = createCatalogElement<AeliqoTableElement>("aeliqo-table", root);
		element.caption = "People";
		element.columns = tableColumns;
		element.rows = tableRows;
		element.identity = ["id"];
		element.entity = "person";
		element.selection = "multiple";
		element.selectedKeys = [personKeys[0]];
		element.result = catalogRef;
		element.page = 1;
		element.pageSize = 10;
		element.totalRows = catalogRows.length;
		element.scope = catalogScope;
	})`,
  "filter-builder": String.raw`((root) => {
		const element = createCatalogElement<AeliqoFilterBuilderElement>("aeliqo-filter-builder", root);
		element.fields = catalogFields;
		element.entity = "person";
		element.scopeLabel = "Authorized people";
		element.autoApply = false;
		element.clauses = [{
			field: "team",
			operator: "eq",
			value: "Research"
		}];
		element.logical = "and";
	})`,
  "selection-summary": String.raw`((root) => {
		const element = createCatalogElement<AeliqoSelectionSummaryElement>("aeliqo-selection-summary", root);
		element.label = "People selected";
		element.entity = "person";
		element.selectedKeys = [personKeys[0], personKeys[1]];
		element.result = catalogRef;
		element.scope = catalogScope;
		element.clearable = true;
	})`,
  "trend": String.raw`((root) => configure(createCatalogElement<AeliqoTrendElement>("aeliqo-trend", root), catalogVisualizationSpecs.trend, catalogVisualizationContext))`,
  "bar": String.raw`((root) => configure(createCatalogElement<AeliqoBarElement>("aeliqo-bar", root), catalogVisualizationSpecs.bar, catalogVisualizationContext))`,
  "area": String.raw`((root) => configure(createCatalogElement<AeliqoAreaElement>("aeliqo-area", root), catalogVisualizationSpecs.area, catalogVisualizationContext))`,
  "scatter": String.raw`((root) => configure(createCatalogElement<AeliqoScatterElement>("aeliqo-scatter", root), catalogVisualizationSpecs.scatter, catalogVisualizationContext))`,
  "histogram": String.raw`((root) => configure(createCatalogElement<AeliqoHistogramElement>("aeliqo-histogram", root), histogramSpec, histogramContext))`,
  "heatmap": String.raw`((root) => configure(createCatalogElement<AeliqoHeatmapElement>("aeliqo-heatmap", root), catalogVisualizationSpecs.heatmap, catalogVisualizationContext))`,
  "matrix": String.raw`((root) => configure(createCatalogElement<AeliqoMatrixElement>("aeliqo-matrix", root), catalogTemporalSpecs.matrix, catalogVisualizationContext))`,
  "relationship": String.raw`((root) => configure(createCatalogElement<AeliqoRelationshipElement>("aeliqo-relationship", root), relationshipSpec, relationshipContext, [relationshipDataset]))`,
  "tree": String.raw`((root) => configure(createCatalogElement<AeliqoTreeElement>("aeliqo-tree", root), hierarchySpec, hierarchyContext, [hierarchyDataset]))`,
  "treemap": String.raw`((root) => configure(createCatalogElement<AeliqoTreemapElement>("aeliqo-treemap", root), treemapSpec, hierarchyContext, [hierarchyDataset]))`,
  "timeline": String.raw`((root) => configure(createCatalogElement<AeliqoTimelineElement>("aeliqo-timeline", root), catalogTemporalSpecs.timeline, catalogVisualizationContext))`,
  "calendar-grid": String.raw`((root) => configure(createCatalogElement<AeliqoCalendarGridElement>("aeliqo-calendar-grid", root), catalogTemporalSpecs["calendar-grid"], catalogVisualizationContext))`,
  "explorer": String.raw`((root) => {
		const element = createCatalogElement<AeliqoExplorerElement>("aeliqo-explorer", root);
		element.fields = catalogFields;
		element.rows = catalogRows;
		element.columns = catalogColumns;
		element.identity = ["id"];
		element.entity = "person";
		element.selectedKey = "string:3:ada";
		element.detailRecord = catalogRows[0];
		element.detailFields = catalogColumns;
		element.result = catalogRef;
		element.scope = catalogScope;
		element.selection = "single";
	})`,
  "comparison": String.raw`((root) => {
		const element = createCatalogElement<AeliqoComparisonElement>("aeliqo-comparison", root);
		element.compareSet = [{
			key: "ada",
			label: "Ada"
		}, {
			key: "grace",
			label: "Grace"
		}];
		element.compareKeys = ["ada", "grace"];
		element.entity = "person";
		element.metrics = [{
			id: "amount",
			label: "Amount",
			unit: "records",
			values: {
				ada: 120,
				grace: 144
			}
		}, {
			id: "team",
			label: "Team",
			values: {
				ada: "Research",
				grace: "Research"
			}
		}];
		element.result = catalogRef;
		element.scope = catalogScope;
	})`,
  "breakdown": String.raw`((root) => {
		const element = createCatalogElement<AeliqoBreakdownElement>("aeliqo-breakdown", root);
		element.groups = [{
			key: "research",
			label: "Research",
			value: 264,
			unit: "records",
			recordCount: 2
		}, {
			key: "product",
			label: "Product",
			value: 96,
			unit: "records",
			recordCount: 1
		}];
		element.rows = catalogRows;
		element.columns = catalogColumns;
		element.identity = ["id"];
		element.entity = "person";
		element.result = catalogRef;
		element.scope = catalogScope;
	})`,
  "investigation": String.raw`((root) => {
		const element = createCatalogElement<AeliqoInvestigationElement>("aeliqo-investigation", root);
		element.entity = "person";
		element.result = catalogRef;
		element.scope = catalogScope;
		element.baseline = 100;
		element.detailRecord = catalogRows[0];
		element.detailFields = catalogColumns;
		element.trend = catalogVisualizationSpecs.trend;
		element.trendContext = catalogVisualizationContext;
		element.trendDatasets = [catalogVisualizationDataset];
	})`,
  "search-results": String.raw`((root) => {
		const element = createCatalogElement<AeliqoSearchResultsElement>("aeliqo-search-results", root);
		element.query = "research";
		element.queryRevision = "query-2";
		element.resultRevision = catalogRef.revision;
		element.rows = catalogRows;
		element.columns = catalogColumns;
		element.identity = ["id"];
		element.selectedKey = "string:3:ada";
		element.entity = "person";
		element.result = catalogRef;
		element.scope = catalogScope;
		element.count = catalogRows.length;
		element.detailRecord = catalogRows[0];
		element.detailFields = catalogColumns;
	})`,
  "record-editor": String.raw`((root) => {
		const element = createCatalogElement<AeliqoRecordEditorElement>("aeliqo-record-editor", root);
		element.entity = "person";
		element.entityKey = "string:3:ada";
		element.entityRevision = "person-revision-1";
		const name = document.createElement("aeliqo-text-field") as AeliqoTextFieldElement;
		name.label = "Name";
		name.name = "name";
		name.value = "Ada Lovelace";
		const period = document.createElement("aeliqo-date-range") as AeliqoDateRangeElement;
		period.label = "Review period";
		period.name = "period";
		period.start = "2026-09-01";
		period.end = "2026-09-30";
		element.append(name, period);
	})`,
  "form-flow": String.raw`((root) => {
		const element = createCatalogElement<AeliqoFormFlowElement>("aeliqo-form-flow", root);
		element.steps = [{
			id: "identity",
			label: "Identity",
			fieldNames: ["name"]
		}, {
			id: "review",
			label: "Review",
			fieldNames: ["period"]
		}];
		element.activeStep = "identity";
		element.draft = { name: "Ada Lovelace" };
		const identity = document.createElement("div");
		identity.slot = "step-identity";
		const name = document.createElement("aeliqo-text-field") as AeliqoTextFieldElement;
		name.label = "Name";
		name.name = "name";
		name.value = "Ada Lovelace";
		identity.append(name);
		const review = document.createElement("div");
		review.slot = "step-review";
		review.textContent = "Review the authorized values before commit.";
		element.append(identity, review);
	})`,
  "quality-panel": String.raw`((root) => {
		const element = createCatalogElement<AeliqoQualityPanelElement>("aeliqo-quality-panel", root);
		element.source = "People registry";
		element.freshness = "2026-09-09 09:00 UTC";
		element.completeness = "3 of 3 rows loaded";
		element.provenance = ["Authorized local snapshot", "Query: catalog-query"];
		element.unsupportedClaims = ["This view does not establish causation."];
		element.state = {
			source: element.source,
			freshness: element.freshness,
			completeness: element.completeness,
			provenance: element.provenance,
			unsupportedClaims: element.unsupportedClaims
		};
	})`,
} as const satisfies Record<CatalogExampleId, string>;

export function catalogMountSource(id: CatalogExampleId): string {
  return CATALOG_MOUNT_SOURCES[id];
}
