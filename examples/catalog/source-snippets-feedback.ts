import type { CatalogExampleId } from './types.js';

export const FEEDBACK_MOUNT_SOURCES = {
  tooltip: String.raw`((root) => {
		const element = createCatalogElement<AeliqoTooltipElement>("aeliqo-tooltip", root);
		element.label = "More information";
		element.content = "Values are scoped to the current report.";
		element.open = true;
	})`,
  popover: String.raw`((root) => {
		const element = createCatalogElement<AeliqoPopoverElement>("aeliqo-popover", root);
		element.label = "Report details";
		element.content = "The report includes the authorized current scope.";
		element.open = true;
		element.modal = false;
	})`,
  dialog: String.raw`((root) => {
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
  drawer: String.raw`((root) => {
		const element = createCatalogElement<AeliqoDrawerElement>("aeliqo-drawer", root);
		element.heading = "Report details";
		element.mode = "inline";
		element.side = "end";
		element.open = true;
		element.textContent = "Inline detail content keeps the surrounding task visible.";
	})`,
  toast: String.raw`((root) => {
		const element = createCatalogElement<AeliqoToastElement>("aeliqo-toast", root);
		element.message = "Report saved";
		element.tone = "success";
		element.open = true;
		element.duration = 0;
		element.dismissible = true;
	})`,
  alert: String.raw`((root) => {
		const element = createCatalogElement<AeliqoAlertElement>("aeliqo-alert", root);
		element.heading = "Review scope";
		element.message = "This page contains the first authorized result window.";
		element.tone = "warning";
		element.actionLabel = "Inspect";
		element.dismissible = true;
		element.open = true;
	})`,
  progress: String.raw`((root) => {
		const element = createCatalogElement<AeliqoProgressElement>("aeliqo-progress", root);
		element.label = "Loading report";
		element.value = 62;
		element.max = 100;
	})`,
  skeleton: String.raw`((root) => {
		const element = createCatalogElement<AeliqoSkeletonElement>("aeliqo-skeleton", root);
		element.label = "Loading report rows";
		element.lines = 3;
		element.variant = "text";
		element.animated = false;
	})`,
  'empty-state': String.raw`((root) => {
		const element = createCatalogElement<AeliqoEmptyStateElement>("aeliqo-empty-state", root);
		element.kind = "no-matches";
		element.heading = "No matching reports";
		element.message = "Try a broader team or date filter.";
		element.actionLabel = "Clear filters";
	})`,
} satisfies Partial<Record<CatalogExampleId, string>>;
