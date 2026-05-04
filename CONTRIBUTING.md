# CONTRIBUTING.md
Thank you for your interest in contributing to Touchpad Gesture Customization. This document explains how to report issues, propose changes, and submit patches so your contribution can be reviewed and merged quickly.

---

## Quick start
1. Fork the repo and clone your fork:
   ```
   git clone https://github.com/<your-username>/touchpad-gesture-customization.git
   cd touchpad-gesture-customization
   git remote add upstream https://github.com/HieuTNg/touchpad-gesture-customization.git
   ```
2. Create a topic branch:
   ```
   git checkout -b feat/my-feature
   ```
3. Make changes, run tests/lint, commit, push:
   ```
   git add .
   git commit -m "Short, descriptive message"
   git push origin feat/my-feature
   ```
4. Open a Pull Request against main.

---

## Supported environments
- GNOME (Wayland). This repo no longer supports X11.
- Target GNOME versions: see README — choose the branch matching your GNOME version.
- Required tooling (example):
  - Node.js and npm (for build & deps)
  - npm scripts provided in package.json
  - GJS and GNOME development libraries for runtime testing

Adjust these to match your OS before contributing.

---

## Development & local testing
1. Install dependencies:
   ```
   npm install
   npm run update
   ```
2. Restart GNOME Shell: Alt+F2 → r (or log out/in).
3. View GNOME Shell logs while testing:
   ```
   journalctl /usr/bin/gnome-shell -f
   ```

---

## Project structure & coding style
- Key files: metadata.json, extension (source), README.md, package.json.
- Language: TypeScript (GJS targets via build pipeline).
- Use ES2020+ features supported by GJS; prefer const/let and modular code.
- Keep extension entry points minimal; put logic in modules.
- Update metadata.json appropriately when changing API compatibility or version.

---

## Linting & formatting
- Use the repository ESLint/Prettier configuration:
  ```
  npm run lint
  npm run format
  ```
- Fix lint errors before opening a PR.

---

## Reporting issues
When opening an issue include:
- GNOME Shell version and distro.
- Extension version (branch used or commit hash).
- Steps to reproduce.
- Expected vs actual behavior.
- Relevant logs from journalctl and screenshots if helpful.
- Attach metadata.json if you think version/API fields are relevant.

Use clear, focused issues — one bug/feature per issue.

---

## Pull requests
PR checklist (include in PR description):
- Summary of changes (1–2 sentences).
- Related issue number (if any).
- Testing performed (GNOME versions, steps).
- Backwards-compatibility notes (if applicable).
- Linting/formatting status: pass.
- Any additional notes for reviewers.

Branching and commits:
- Work on a feature/topic branch.
- Rebase/squash commits into meaningful units before merge if requested.
- Use clear commit messages.
- **Keep commits small, with a well defined scope and single purpose**
- **Avoid a giant PR with a few giant commits with no clearly defined scope of change**

PR review process:
- Runs lint/build/tests. Address failures promptly.
- Respond to review comments; maintainers may request changes before merging.

---

## Releases & packaging
- Releases are zip packages containing the extension folder and a matching metadata.json version.
- Follow semantic versioning where practical; update metadata.json version and api-version when releasing support for new GNOME versions.

---

## Testing guidance
Manual checklist for changes affecting gestures or behavior:
- Install and enable extension locally.
- Test on the target GNOME version(s) (note known GNOME 49 issues in README).
- Verify gestures listed in README, including hold-and-swipe and pinch where applicable.
- Inspect journalctl for errors or warnings.

If you add automated tests, include instructions to run them in README or package.json scripts.

---

## Security
If you discover a security vulnerability, please follow the repository SECURITY.md procedure (do not disclose publicly until fixed).

---

## Code of conduct
Be respectful and constructive. See CODE_OF_CONDUCT.md for details.

---

## Templates
1. PR template
```
### Summary
[Short description of changes]

### Related issue
#<number> (if any)

### Testing
[GNOME versions tested, steps]

### Checklist
- [ ] Lint passes
- [ ] Tested locally
- [ ] Updated metadata.json if needed
```

2. issue template
```
### Describe the bug
[Short summary]

### Steps to reproduce
1.
2.
3.

### Expected behavior
[What you expected]

### Environment
- GNOME Shell:
- Extension version/branch:
- Distro:
- Logs: (attach relevant journalctl output)
```