# Chrome Web Store Permission Justifications

## Updated Permissions (Minimal Set)

Your extension now uses only these permissions:
- `storage`
- `activeTab`
- `cookies`

## Justifications for Chrome Web Store Submission

### **Storage Justification**
```
Used to persist user's API request tabs, request history, and editor content across browser sessions. This ensures users don't lose their work when closing DevTools or the browser.
```

### **ActiveTab Justification**
```
Required to execute user-initiated HTTP requests from the DevTools panel. When a developer explicitly clicks "Execute" or presses Ctrl+Enter, the extension makes the API request to test endpoints. This permission grants temporary access only to the active tab and only in response to explicit user actions.
```

### **Cookies Justification**
```
Allows viewing and inspecting cookies in API responses for debugging authentication flows and session management. Essential for testing APIs that use cookie-based authentication.
```

---

## Why These Changes Were Made

**Removed:**
- ❌ `<all_urls>` host permission → Replaced with `activeTab` (more secure, faster review)
- ❌ `scripting` → Not needed for core functionality
- ❌ `tabs` → Not needed with activeTab
- ❌ `notifications` → Not currently used
- ❌ `sidePanel` → Not essential for core API testing
- ❌ Content scripts → Not needed for DevTools-based testing
- ❌ New tab override → Not essential

**Benefits:**
- ✅ Much faster Chrome Web Store review process
- ✅ More trustworthy to users (minimal permissions)
- ✅ Still fully functional for API testing
- ✅ No "broad host permissions" warning

---

## How It Works Now

The `activeTab` permission is perfect for your use case because:

1. **User-initiated**: Requests only happen when the user explicitly clicks Execute
2. **Temporary access**: Permission is granted only while the user is on that tab
3. **Secure**: No permanent access to any websites
4. **DevTools-friendly**: Works seamlessly with your DevTools panel

This is the recommended approach for extensions that make requests on behalf of the user.
