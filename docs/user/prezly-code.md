# Create a project in Prezly.code

Connect to the Prezly network through Warp. If the Jude login is missing or expired, Prezly.code
opens a GitHub sign-in window and resumes environment discovery after authentication succeeds.

Choose **Create project** in the left sidebar, the new-prompt project picker, the empty project
screen, or the command palette. Select the repository, branch, GitHub identity, and model for the
new Jude environment. Prezly projects can also include optional custom license IDs.

Once Jude accepts the environment, Prezly.code closes the dialog and immediately shows the app name
in the left sidebar with its provisioning status. Only environments created in the running app get
this temporary row; existing Jude environments remain in the project picker. The row becomes
interactive as soon as the project connects and remains until the first user prompt is submitted.
Project picker entries show both the Jude app and environment name, while thread breadcrumbs use the
environment name. If provisioning fails or takes longer than 15 minutes, the sidebar reports the
failure; the environment can still be picked up later with **Refresh Jude environments**.

When Jude supplies a preview URL, choose **Preview** from the right panel to open the environment's
attached preview in a browser surface. Choose **Jude details** to open the environment's Jude
session page.
