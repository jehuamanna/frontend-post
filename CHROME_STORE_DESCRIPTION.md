# Frontend Post - Chrome Web Store Description

## Short Description (132 characters max)
A powerful DevTools extension for testing HTTP requests. Paste cURL/fetch commands, execute them, and view formatted responses.

## Detailed Description

**Frontend Post** is a developer-focused Chrome extension that brings powerful API testing capabilities directly into your browser's DevTools panel.

### 🚀 Key Features

**Effortless Request Testing**
- Paste cURL or fetch commands directly into the editor
- Automatic parsing of HTTP methods, URLs, headers, and body
- Support for GET, POST, PUT, PATCH, DELETE, and more
- Execute requests with a single click or Ctrl/Cmd + Enter

**Beautiful Response Viewing**
- Syntax-highlighted JSON responses
- View response status codes with color-coded indicators
- Inspect response headers and cookies
- Monaco Editor integration for a premium editing experience

**Multi-Tab Workflow**
- Work with multiple requests simultaneously
- Automatic tab naming based on HTTP method and endpoint
- Custom tab renaming support
- Smart tab management with number reuse

**Developer-Friendly**
- Integrated directly into Chrome DevTools
- No context switching required
- Persistent tab state across sessions
- Clean, modern UI with dark mode support

### 💡 Perfect For

- Frontend developers testing APIs
- Debugging network requests
- Converting cURL commands from documentation
- Quick API endpoint validation
- Testing authentication flows
- Inspecting API responses

### 🎯 How It Works

1. Open Chrome DevTools (F12)
2. Navigate to the "Front Post" panel
3. Paste your cURL or fetch command
4. Click Execute or press Ctrl/Cmd + Enter
5. View the formatted response instantly

### 🔒 Privacy & Security

- All requests are executed locally in your browser
- No data is sent to external servers
- Your API keys and sensitive data stay private
- Open source and transparent

### 📝 Example Use Cases

**Convert cURL to test:**
```bash
curl -X POST https://api.example.com/users \
  -H "Content-Type: application/json" \
  -d '{"name": "John Doe"}'
```

**Test fetch requests:**
```javascript
fetch('https://api.example.com/data', {
  method: 'GET',
  headers: { 'Authorization': 'Bearer token' }
})
```

### 🛠️ Built With Modern Tech

- React + TypeScript for reliability
- Monaco Editor for professional code editing
- Vite for fast builds
- TailwindCSS for beautiful UI

### 📖 Open Source

Frontend Post is open source and actively maintained. Contributions welcome!

---

**Get started with Frontend Post today and streamline your API testing workflow!**
