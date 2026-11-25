# Azure Container Apps and Microsoft Entra ID

This demo uses a managed identity to pull a private container image and Azure Container Apps built-in authentication to sign a presenter in with Microsoft Entra ID.

The app uses the principal header inserted by Azure Container Apps to display a status. Sign-in is enforced by the platform. The application does not display claims or tokens.
