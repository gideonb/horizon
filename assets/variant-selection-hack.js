// The "fix" for hidden selected values, done as dumbly as possible on purpose.
// When the server marks a hidden value as selected, the only correction available to the
// theme is to pick a visible value and ask the server again — one full section-rendering
// round trip per option, serially, because each response can invalidate the next option down.
// A production version could be smarter about *which* value it picks, but not about the
// round trips: the selected state only exists on the server.

const MAX_FIXES = 10;
const ROUND_TRIP_DELAY = 500; // slow enough to watch each round trip land

let fixCount = 0;
let scheduled = false;

function isVisible(input) {
  return input.closest('label')?.offsetParent != null;
}

// Buttons: first fieldset whose checked radio is hidden (or missing) → click a visible one
function findRadioFix(picker) {
  for (const fieldset of picker.querySelectorAll('fieldset')) {
    const checked = fieldset.querySelector('input:checked');
    if (checked && isVisible(checked)) continue;

    const visible = Array.from(fieldset.querySelectorAll('input')).find(isVisible);
    if (visible) return () => visible.click();
  }
  return null;
}

// Dropdowns: first select whose selected option is hidden → select a visible one
function findSelectFix(picker) {
  for (const select of picker.querySelectorAll('select')) {
    const selected = select.selectedOptions[0];
    if (!selected?.hidden) continue;

    const visible = Array.from(select.options).find((option) => !option.hidden);
    if (visible) {
      return () => {
        select.value = visible.value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      };
    }
  }
  return null;
}

function fixPass() {
  scheduled = false;

  for (const picker of document.querySelectorAll('variant-picker')) {
    const fix = findRadioFix(picker) || findSelectFix(picker);

    if (fix && fixCount < MAX_FIXES) {
      fixCount += 1;
      fix(); // change event → fetch → morph → the observer schedules the next pass
      return;
    }
  }

  fixCount = 0;
}

function scheduleFixPass() {
  if (scheduled) return;
  scheduled = true;
  setTimeout(fixPass, ROUND_TRIP_DELAY);
}

new MutationObserver(scheduleFixPass).observe(document.body, {
  childList: true,
  subtree: true,
  attributes: true,
});

// The initial page load can already be in a hidden-selected state (?option_values= deep link)
scheduleFixPass();
