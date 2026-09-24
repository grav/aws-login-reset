# AWS Login Reset

A small, unpacked Chromium extension that removes stale cookies scoped to AWS
sign-in hosts. It is intended as a workaround for `aws login` returning HTTP
400 when a browser retains an expired AWS sign-in session.

It does not clear browsing history, cache, local storage, browser identifiers,
consent settings, or unrelated AWS Console cookies. Cookie values are never
displayed, stored, or transmitted.

## Install

1. Open `chrome://extensions` (or `brave://extensions`).
2. Enable **Developer mode**.
3. Select **Load unpacked**.
4. Choose this `aws-login-reset` directory.
5. Pin **AWS Login Reset** to the toolbar if desired.

## Use

When an AWS sign-in navigation returns HTTP 400, the extension automatically
opens its popup and asks whether it should remove the stale authentication
cookies. Nothing is deleted unless you select **Remove cookies and retry**.

If Chromium prevents the automatic popup from opening, the extension icon shows
a red `400` badge; click it to see the same prompt. Leave reload enabled to retry
the current authorization URL immediately. If that URL has already expired, run
`aws login` again.

## Scope

The extension can access cookies for these HTTPS host patterns:

- `signin.aws` and its subdomains
- `signin.aws.amazon.com` and its subdomains
- subdomains of `aws.amazon.com`, because AWS may scope authentication cookies
  to the parent domain

The code applies a second domain check before removing anything. On a sign-in
host it removes that host's cookies. On the broader `aws.amazon.com` domain, it
removes only an explicit allowlist of authentication cookie names used by the
same-device login flow. In particular, it preserves browser-ID and cookie-consent
cookies.

The extension observes only top-level requests to the declared AWS sign-in
hosts. It reads the HTTP status and URL path, but not request headers, response
bodies, cookie values, or OAuth query parameters. Automatic popup opening
requires Chromium 127 or newer.

## License

Licensed under the [MIT License](LICENSE).
