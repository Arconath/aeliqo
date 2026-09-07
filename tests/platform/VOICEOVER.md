# Native VoiceOver feasibility check

This is a narrow T02 check with real macOS VoiceOver, separate from the full
manual assistive-technology release matrix. It does not certify all components,
all browsers, or every VoiceOver navigation mode.

Build the platform packages, serve `examples/platform` in a native Chrome
window, and focus the fixture's Name field. Record the source digest, macOS,
Chrome and VoiceOver versions. Use only the synthetic fixture records. A browser
accessibility snapshot alone does not establish what VoiceOver reads.

With explicit owner approval, temporarily enable VoiceOver and its Utility's
"Allow VoiceOver to be controlled with AppleScript" setting. Record both initial
states and restore them after the check. Do not enable scripting automatically
in CI or change unrelated accessibility preferences.

The installed VoiceOver dictionary exposes `content of last phrase`, `vo cursor`
movement and `commander` commands. Actual command names can be checked in the
installed `SCRStringsToCommandsMap.scrconfig`; the tested English commands include
"move voiceover cursor to keyboard focus", "find previous text field", and
"find next table". Activate the native browser before each script and wait for
its activation. Synchronize to a known keyboard focus rather than assuming the
VoiceOver cursor survives application switching.

Verify these operations by reading VoiceOver's output after each operation:

- Name: value, label and required state are announced. The hint is a description,
  not part of the accessible name and not repeated as a second copy of the label.
- People: interact with the scroll group/table. Verify its two columns, header
  names, Ada/Engineer and Grace/Researcher cell associations.
- Weekly activity: read the title, description, unit and image description. Reach
  the collapsed "View data table" disclosure, activate it through the VoiceOver
  cursor, then enter the revealed table. Verify headers and Mon=3, Tue=5, Wed=4.

Capture the actual phrases, not expected strings substituted for output. Bound
navigation loops and fail if the requested control is not reached. Preserve failed
attempts as failures. Keep the final run linked to its immutable evidence directory.
The first run found hint text inside the wrapping label; the corrected run used
rebuilt packages and a fresh page load, since old custom-element definitions can
otherwise survive a development reload.
