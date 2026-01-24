<div align="center">

# Bloom

<br/>

<div>
  <img src="https://img.shields.io/badge/Turborepo-EF4444?style=for-the-badge&logo=turborepo&logoColor=white" alt="Turborepo">
  <img src="https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js&logoColor=white" alt="Next.js">
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React">
  <img src="https://img.shields.io/badge/ESLint-4B32C3?style=for-the-badge&logo=eslint&logoColor=white" alt="ESLint">
  <img src="https://img.shields.io/badge/Prettier-F7B93E?style=for-the-badge&logo=prettier&logoColor=black" alt="Prettier">
  <img src="https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white" alt="Vercel">
</div>

<br/>

**A high-performance monorepo built with Turborepo, featuring multiple Next.js applications with shared UI components, configurations, and optimized build pipelines for scalable web development.**

<p>
  <a href="#about-the-project">About</a> •
  <a href="#key-features">Features</a> •
  <a href="#getting-started">Getting Started</a> •
  <a href="#contributing">Contributing</a> •
  <a href="#license">License</a>
</p>

[**Live Demo**](https://bloom-web-o2zx.vercel.app) · [**Report a Bug**](https://github.com/neutron420/bloom/issues) · [**Request a Feature**](https://github.com/neutron420/bloom/issues)

</div>

## About The Project

Bloom is a modern monorepo architecture powered by Turborepo, designed to manage multiple Next.js applications and shared packages efficiently. The project demonstrates best practices for organizing large-scale web applications with shared UI components, unified configurations, and optimized build processes. With remote caching and intelligent task scheduling, Bloom ensures fast development cycles and consistent deployments across multiple applications.

### Built With

This monorepo leverages cutting-edge tools for maximum developer productivity and application performance.

* **Monorepo Tool:** [Turborepo](https://turborepo.org/)
* **Framework:** [Next.js](https://nextjs.org/) 14
* **Language:** [TypeScript](https://www.typescriptlang.org/)
* **UI Library:** [React](https://react.dev/) 19
* **Code Quality:** [ESLint](https://eslint.org/), [Prettier](https://prettier.io/)
* **Deployment:** [Vercel](https://vercel.com/)
* **Development Tools:** [ngrok](https://ngrok.com/) for local tunneling

## Key Features

* **Monorepo Architecture:** Efficient code sharing and management across multiple applications
* **Shared UI Components:** Reusable React component library across all apps
* **Unified Configuration:** Centralized ESLint and TypeScript configurations
* **Remote Caching:** Vercel Remote Cache for faster builds across team and CI/CD
* **Parallel Task Execution:** Turborepo's intelligent task scheduling for optimal performance
* **Type Safety:** Full TypeScript support across all packages and applications
* **Hot Module Replacement:** Fast refresh and development experience
* **Incremental Builds:** Only rebuild what changed for lightning-fast iterations
* **Workspace Management:** Efficient dependency management with npm workspaces
* **Production Ready:** Optimized builds with automatic code splitting and tree shaking

## Monorepo Structure

```
bloom/
├── apps/
│   ├── web/              # Main Next.js web application
│   └── docs/             # Documentation Next.js app
├── packages/
│   ├── ui/               # Shared React component library
│   ├── eslint-config/    # Shared ESLint configurations
│   └── typescript-config/# Shared TypeScript configurations
├── turbo.json            # Turborepo pipeline configuration
├── package.json          # Root package.json with workspaces
└── .vscode/              # VS Code workspace settings
```

## Getting Started

To get a local copy up and running for development, follow these simple steps.

### Prerequisites

You will need Node.js (version 18 or higher) and npm installed on your system.

* **Recommended:** Install Turborepo globally for better CLI experience
  ```sh
  npm install -g turbo
  ```

### Installation

1.  **Clone the repository:**
    ```sh
    git clone https://github.com/neutron420/bloom.git
    cd bloom
    ```

2.  **Install dependencies:**
    ```sh
    npm install
    ```

3.  **Set up environment variables:**
    Create `.env.local` files in each app directory as needed:
    ```sh
    # apps/web/.env.local
    # apps/docs/.env.local
    ```

4.  **Start development servers:**
    ```sh
    # With global turbo
    turbo dev
    
    # Without global turbo
    npx turbo dev
    ```

   This will start all applications in development mode simultaneously.

### Develop Specific Apps

Run a specific application:

```sh
# Web app only
turbo dev --filter=web

# Docs app only
turbo dev --filter=docs
```

## Available Scripts

### Development

```sh
# Start all apps in development mode
turbo dev

# Start specific app
turbo dev --filter=web
```

### Build

```sh
# Build all apps and packages
turbo build

# Build specific app
turbo build --filter=web
```

### Linting

```sh
# Lint all packages
turbo lint

# Fix linting issues
turbo lint --fix
```

### Type Checking

```sh
# Type check all packages
turbo typecheck
```

## Apps and Packages

### Applications

* **web** - Main Next.js web application deployed at [bloom-web-o2zx.vercel.app](https://bloom-web-o2zx.vercel.app)
* **docs** - Documentation and design system showcase

### Shared Packages

* **@repo/ui** - Shared React component library used across all applications
* **@repo/eslint-config** - Unified ESLint configuration (includes eslint-config-next and eslint-config-prettier)
* **@repo/typescript-config** - Shared TypeScript configurations for consistency

## Turborepo Features

### Pipeline Configuration

Turborepo uses `turbo.json` to define task dependencies and caching strategies:

```json
{
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**"]
    },
    "dev": {
      "cache": false
    },
    "lint": {
      "outputs": []
    }
  }
}
```

### Remote Caching

Enable remote caching for team collaboration:

```sh
# Login to Vercel
turbo login

# Link to remote cache
turbo link
```

Benefits:
* Share build cache across team members
* Faster CI/CD pipelines
* Consistent builds across environments

### Task Filtering

Run tasks for specific packages:

```sh
# Run build only for web app and its dependencies
turbo build --filter=web

# Run dev for all apps in /apps directory
turbo dev --filter=./apps/*
```

## Development Workflow

1. **Create a new feature:**
   ```sh
   git checkout -b feature/amazing-feature
   ```

2. **Make changes in any app or package**
   - Changes to shared packages automatically trigger rebuilds in dependent apps
   - Hot reload works across the entire monorepo

3. **Run checks:**
   ```sh
   turbo lint
   turbo typecheck
   turbo build
   ```

4. **Commit and push:**
   ```sh
   git add .
   git commit -m 'Add amazing feature'
   git push origin feature/amazing-feature
   ```

5. **Create Pull Request**

## Adding New Packages

### Add a New App

```sh
# Create new Next.js app
cd apps
npx create-next-app@latest my-new-app
```

Update `turbo.json` and root `package.json` to include the new app.

### Add a New Shared Package

```sh
# Create new package
mkdir -p packages/my-package
cd packages/my-package
npm init -y
```

Update package references in apps that need to use it.

## Deployment

### Vercel Deployment

The project is configured for seamless Vercel deployment:

1. **Connect Repository:** Link your GitHub repository to Vercel
2. **Configure Root:** Set the root directory to the specific app (e.g., `apps/web`)
3. **Deploy:** Vercel automatically detects Next.js and builds with Turborepo

### Manual Deployment

Build for production:

```sh
turbo build --filter=web
```

Deploy the `.next` folder from the built app to your hosting platform.

## Environment Variables

Each app can have its own environment variables:

```
apps/
├── web/
│   └── .env.local
└── docs/
    └── .env.local
```

Shared environment variables can be defined at the root level.

## CI/CD Integration

Turborepo works seamlessly with CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Install dependencies
  run: npm install

- name: Build
  run: npx turbo build

- name: Test
  run: npx turbo test
```

Remote caching speeds up CI builds significantly.

## Technologies Deep Dive

### Turborepo Benefits
* **Incremental Builds:** Only rebuild changed packages
* **Parallel Execution:** Run tasks across packages simultaneously
* **Smart Caching:** Local and remote caching for faster builds
* **Dependency Management:** Automatic task dependency resolution

### TypeScript Configuration
Shared TypeScript configs ensure consistency:
* `@repo/typescript-config/base.json` - Base configuration
* `@repo/typescript-config/nextjs.json` - Next.js specific settings
* `@repo/typescript-config/react-library.json` - React library settings

## Contributing

Contributions are what make the open-source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

If you have a suggestion that would make this better, please fork the repo and create a pull request. You can also simply open an issue with the tag "enhancement".

1.  Fork the Project
2.  Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4.  Push to the Branch (`git push origin feature/AmazingFeature`)
5.  Open a Pull Request

## License

Distributed under the MIT License. See `LICENSE` for more information.

## Contact

Project Link: [https://github.com/neutron420/bloom](https://github.com/neutron420/bloom)

Live Demo: [https://bloom-web-o2zx.vercel.app](https://bloom-web-o2zx.vercel.app)

## Acknowledgments

* [Turborepo Documentation](https://turborepo.org/docs)
* [Next.js Documentation](https://nextjs.org/docs)
* [Vercel Platform](https://vercel.com/)
* [TypeScript Documentation](https://www.typescriptlang.org/docs/)
