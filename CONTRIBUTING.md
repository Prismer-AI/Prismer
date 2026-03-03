# Contributing to Prismer.AI

Thank you for your interest in contributing to Prismer.AI! This document provides guidelines and information for contributors.

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for everyone.

## How to Contribute

### Reporting Issues

- Search existing issues before creating a new one
- Use the issue templates when available
- Provide clear reproduction steps for bugs
- Include relevant system information

### Pull Requests

1. **Fork the repository** and create your branch from `main`
2. **Write clear commit messages** following [Conventional Commits](https://www.conventionalcommits.org/)
3. **Add tests** for new functionality
4. **Update documentation** as needed
5. **Ensure all tests pass** before submitting

### Commit Message Format

```text
type(scope): description

[optional body]

[optional footer]
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

Example:

```text
feat(paper-reader): add citation extraction from PDFs

- Implemented PDF parsing for reference sections
- Added support for common citation formats
- Integrated with Semantic Scholar API

Closes #123
```

## Development Setup

```bash
cd web
npm install
cp .env.docker.example .env    # Edit and add your OPENAI_API_KEY
npm run db:generate && npm run db:push
npm run dev                    # → http://localhost:3000
```

Requires **Node.js 18+**. For the full development guide (environment variables, Docker profiles, testing), see [docs/CONTRIB.md](docs/CONTRIB.md).

## Areas We Need Help

### Academic Domain Experts

Help us understand research workflows better and validate our approach to academic tooling.

### Frontend Engineers

- Improve component UX and accessibility
- Optimize performance for large documents
- Enhance mobile responsiveness

### ML Engineers

- Enhance RAG pipeline for citation accuracy
- Improve citation verification algorithms
- Optimize embedding strategies

### Technical Writers

- API documentation
- Tutorials and guides
- Example projects

## Questions?

Feel free to open an issue for any questions about contributing.

---

Thank you for helping make academic research more accessible! 🎓
