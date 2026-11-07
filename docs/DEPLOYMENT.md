# Deploying OBSCURA to GitHub Pages

OBSCURA is a static site, so GitHub Pages hosts it for free. The repository already contains the workflow (`.github/workflows/pages.yml`), which runs the tests, builds the site and deploys it on every push to `main`.

## One-time setup

1. **Create the repository** on GitHub, named `obscura`. It can be public or private (Pages on a private repository needs a paid plan).

2. **Push the code.** From the project folder:

   ```bash
   git branch -M main
   git remote add origin https://github.com/<your-username>/obscura.git
   git push -u origin main
   ```

3. **Turn on Pages.** In the repository go to **Settings → Pages**, and under **Build and deployment** set **Source** to **GitHub Actions**.

4. **Wait for the workflow.** Open the **Actions** tab. When the "Test and deploy" run finishes, the site is live at:

   ```
   https://<your-username>.github.io/obscura/
   ```

That is all. The workflow sets `VITE_GITHUB_REPO` to your repository automatically, so the submission form opens issues on the right repository without any further configuration.

## Things that are worth checking after the first deploy

- Open the live address and play the entrance, then enter a room.
- Open **Transmit**, prepare a test submission, and check that **Open on GitHub** opens a prefilled issue on *your* repository. Close it without submitting.
- Check the issue form appears as expected: Settings → General → Features → Issues must be enabled.
- Create the two labels the form uses, `submission` and `needs-review`, so new submissions are labelled (**Issues → Labels**).
- Share the link somewhere and check the social preview (the image is `public/og.png`).

## Custom domain

If you add a custom domain in **Settings → Pages**, nothing in the build needs to change, since all asset paths are relative.

## Building locally

```bash
npm run build      # outputs to dist/
npm run preview    # serves it locally
```

To test the submission link locally, build with the variable set:

```bash
VITE_GITHUB_REPO=your-username/obscura npm run build
```

## If something looks wrong

| Symptom | Likely cause |
| --- | --- |
| The Actions run does not start | Check that Pages **Source** is set to **GitHub Actions**, and that Actions are enabled for the repository. |
| The page is blank | Open the browser console. The site needs JavaScript, and a very old browser may not support ES2022. |
| The form says it is "not connected to a repository" | The build ran without `VITE_GITHUB_REPO`. Deploy through the workflow, or build locally with the variable set. |
| Rooms do not load from a sub-path | They should; paths are relative. If you changed `base` in `vite.config.js`, restore it to `'./'`. |
