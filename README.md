# House of Neuro

This project uses a `.env` file for configuration. The committed `.env` contains placeholder values only.

Replace these placeholders with your real credentials before deploying. Never commit production secrets to the repository—configure them directly in the deployment environment to keep sensitive data out of public git history.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `REACT_APP_BASE_URL` | Base URL of the frontend used when generating password reset links. When the app is served from localhost this value is used; otherwise the current origin is used. |
| `REACT_APP_API_BASE` | Base URL of the API server used to send reset emails. When running on localhost this value can point to a different server (e.g. `http://localhost:3001`); in production the current origin is used automatically. |
