# Cuento Frontend

The official frontend for the Cuento role-playing forum platform, designed to provide a modern, responsive, and feature-rich user experience. This application is built with Angular and is styled to emulate the classic, lightweight feel of forum software like PunBB/MyBB while leveraging modern web technologies.

## Table of Contents

- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Backend Configuration](#backend-configuration)
  - [Running the Development Server](#running-the-development-server)
- [Project Structure](#project-structure)
- [Available Scripts](#available-scripts)
- [License](#license)

## Key Features

- **Modern Forum Experience:** A fast, single-page application (SPA) interface for browsing forums, topics, and posts.
- **Role-Playing First:** Core features are built around the needs of a role-playing community, including character creation, character lists, and episode tracking.
- **Dynamic Character Sheets:** Create characters using templates with custom field types (text, numbers, images, etc.).
- **Component-Based Architecture:** A modular and maintainable codebase with reusable UI components for elements like text fields, image fields, and navigation.
- **Reactive State Management:** Utilizes Angular Signals for efficient and predictable state management across the application.
- **Authentication:** Secure user registration, login, and session management via JWT.

## Tech Stack

- **Framework:** [Angular](https://angular.io/) (v17+)
- **Language:** [TypeScript](https://www.typescriptlang.org/)
- **State Management:** Angular Signals
- **Styling:** CSS with a structure inspired by MyBB/PunBB themes.
- **Icons:** [Bootstrap Icons](https://icons.getbootstrap.com/)

## Getting Started

Follow these instructions to get a copy of the project up and running on your local machine for development and testing purposes.

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later recommended)
- [npm](https://www.npmjs.com/) (usually comes with Node.js)
- A running instance of the Cuento backend API.

### Installation

1.  **Clone the repository:**
    ```sh
    git clone <your-repository-url>
    cd cuento-frntend
    ```

2.  **Install dependencies:**
    ```sh
    npm install
    ```

### Backend Configuration

This frontend application requires a running backend API to function correctly.

By default, the application expects the API to be available at `http://localhost/api`. This is configured in the service files (e.g., `src/app/services/auth.service.ts`).

If your backend is running on a different URL, you must update the `apiUrl` constant in all relevant service files within `src/app/services/`.

### Running the Development Server

Once the dependencies are installed and the backend is configured and running, you can start the Angular development server:

```sh
npm start
```

This command will compile the application, start a development server, and watch the source files for changes. Navigate to `http://localhost:4200/` in your browser to see the application.

## Project Structure

The project follows a standard Angular CLI structure. Key directories inside `src/app/` include:

-   **/components**: Contains reusable, "dumb" UI components that are used across multiple features (e.g., `long-text-field`, `navlinks`).
-   **/services**: Contains application-wide services responsible for API communication (`api.service.ts`), authentication (`auth.service.ts`), and managing application state.
-   **/models**: Contains TypeScript interfaces that define the shape of the data models used in the application (e.g., `Faction.ts`, `Character.ts`).
-   **Feature Folders** (e.g., `/home`, `/character-list`, `/topic-create`): Each major feature or page of the application is organized into its own module-like folder, containing its component, template, and styles.

## Available Scripts

In the project directory, you can run:

-   `npm start`: Runs the app in development mode.
-   `npm run build`: Builds the app for production to the `dist/` folder.
-   `npm run test`: Launches the test runner in interactive watch mode.

## License

This project is licensed under the Apache 2.0 License - see the `LICENSE.md` file for details.
