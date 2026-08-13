# Login fails after updating to v2.1.0

**Describe the bug**

After updating to v2.1.0, logging in with valid credentials shows an error and returns to the login screen.

## Steps to reproduce

1. Open the application
2. Enter valid credentials
3. Click "Sign in"

## Expected behaviour

The user is signed in and sees the dashboard.

## Actual behaviour

An error banner appears and the login screen is shown again.

## Environment

- Application version: 2.1.0
- macOS 15
- Chrome 126
- Node.js 22

## Logs

```console
Error: session token expired
    at Session.validate (src/session.ts:41)
```

## Screenshots

![login error](https://user-images.githubusercontent.com/1/login-error.png)

This worked before in v2.0.3.

Minimal reproduction: https://stackblitz.com/edit/login-bug-repro
