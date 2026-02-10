# Architecture Documentation

> **Index:**

- [Architecture Documentation](#architecture-documentation)
	- [📁 Documents in This Directory](#-documents-in-this-directory)
		- [ARCHITECTURE.md](#architecturemd)
		- [DYNAMIC\_DOMAINS.md](#dynamic_domainsmd)
		- [KEEP\_ALIVE.md](#keep_alivemd)
	- [🔗 Quick Navigation](#-quick-navigation)
	- [📚 Related Documentation](#-related-documentation)
	- [🎯 For Developers](#-for-developers)
	- [🔄 Document Status](#-document-status)

This directory contains technical documentation about the internal architecture, design patterns, and system components of the RanobeGemini extension.

---

## 📁 Documents in This Directory

### [ARCHITECTURE.md](./ARCHITECTURE.md)

Comprehensive architectural overview of the extension

- System architecture diagrams with detailed component tables
- Extension component breakdown (Content Scripts, Background, Popup, Handlers)
- Data flow sequences and processing pipelines
- Handler system class hierarchy
- Storage schema and API integration patterns
- Performance and security considerations

**Key Topics:**
- 📊 System-wide Mermaid diagrams with component tables
- 🔧 Core extension components and their interactions
- 🎯 Website handler strategy pattern
- 📦 Storage architecture and data models
- 🔄 Content processing pipeline
- 🔐 API integration and key rotation

---

### [DYNAMIC_DOMAINS.md](./DYNAMIC_DOMAINS.md)

Dynamic domain management system documentation

- Domain registration system
- Handler-based domain discovery
- Manifest generation automation
- Domain constant management
- Adding new domains workflow

**Key Topics:**
- 🌐 Multi-domain support system
- 🤖 Automated manifest updates
- 📝 Domain constant patterns
- ➕ New domain integration guide

---

### [KEEP_ALIVE.md](./KEEP_ALIVE.md)

Three-layer keep-alive system documentation

- Offscreen document heartbeat mechanism (Chrome MV3)
- Background alarm API and port listener architecture
- Content script long-lived port connections
- Timing considerations and browser differences
- Lifecycle management and debugging tips

**Key Topics:**
- 🔄 Three-layer redundant keep-alive architecture
- ⏱️ 20s/30s interval timing rationale
- 🔌 Port-based heartbeat system
- 🐛 Debugging and troubleshooting guide
- 🔧 Chrome vs Firefox implementation differences

---

## 🔗 Quick Navigation

| Topic                 | Document                                                          | Section                       |
| --------------------- | ----------------------------------------------------------------- | ----------------------------- |
| **System Overview**   | [ARCHITECTURE.md](./ARCHITECTURE.md#overview)                     | High-level system description |
| **Component Details** | [ARCHITECTURE.md](./ARCHITECTURE.md#extension-components)         | Deep dive into each component |
| **Handler System**    | [ARCHITECTURE.md](./ARCHITECTURE.md#4-website-handlers-utilswebsite-handlers)  | Website handler architecture  |
| **Processing Flow**   | [ARCHITECTURE.md](./ARCHITECTURE.md#content-processing-pipeline)  | How content is processed      |
| **Storage Design**    | [ARCHITECTURE.md](./ARCHITECTURE.md#storage-architecture)         | Data persistence patterns     |
| **API Integration**   | [ARCHITECTURE.md](./ARCHITECTURE.md#api-integration-architecture) | Gemini API communication      |
| **Domain System**     | [DYNAMIC_DOMAINS.md](./DYNAMIC_DOMAINS.md)                        | Multi-domain support          |
| **Keep-Alive System** | [KEEP_ALIVE.md](./KEEP_ALIVE.md)                                  | Service worker persistence    |

---

## 📚 Related Documentation

- **[Main Documentation](../README.md)** - Start here for overview
- **[Features Documentation](../features/README.md)** - Feature-specific guides
- **[Development Guides](../development/README.md)** - Development workflows
- **[User Guides](../guides/README.md)** - Adding new websites and usage guides

---

## 🎯 For Developers

If you're looking to understand how the extension works internally:

1. **Start with:** [ARCHITECTURE.md - Overview](./ARCHITECTURE.md#overview)
2. **Then read:** [ARCHITECTURE.md - System Architecture](./ARCHITECTURE.md#system-architecture)
3. **Deep dive:** [ARCHITECTURE.md - Extension Components](./ARCHITECTURE.md#extension-components)
4. **Understand data flow:** [ARCHITECTURE.md - Content Processing Pipeline](./ARCHITECTURE.md#content-processing-pipeline)

If you're adding support for a new website:

1. **Read:** [ARCHITECTURE.md - Handler System](./ARCHITECTURE.md#4-website-handlers-utilswebsite-handlers)
2. **Then see:** [DYNAMIC_DOMAINS.md](./DYNAMIC_DOMAINS.md)
3. **Follow guide:** [Adding New Websites](../guides/ADDING_NEW_WEBSITES.md)

---

## 🔄 Document Status

| Document           | Last Updated | Status         | Completeness |
| ------------------ | ------------ | -------------- | ------------ |
| ARCHITECTURE.md    | 2025-01-15   | ✅ Up to date   | 100%         |
| DYNAMIC_DOMAINS.md | 2024-12-28   | ⚠️ Needs update | 85%          |

---

**Navigation:** [Back to Main Docs](../README.md) | [Features →](../features/README.md) | [Development →](../development/README.md)
