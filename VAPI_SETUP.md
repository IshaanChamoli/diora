# Vapi Voice AI Setup Guide

## What You Need to Do:

### 1. Get Your Vapi API Key
1. Go to [Vapi Dashboard](https://dashboard.vapi.ai/)
2. Sign up or log in to your account
3. Navigate to the API Keys section
4. **Copy your PUBLIC API key** (starts with `sk-`)

### 2. Get Your Assistant ID
1. In the Vapi Dashboard, go to **"Assistants"** section
2. Create a new assistant or use an existing one
3. **Copy the Assistant ID** (it's in the URL or assistant details)

### 3. Set Up Environment Variables
Create a `.env.local` file in your project root with:
```
NEXT_PUBLIC_VAPI_API_KEY=sk-your-actual-public-key-here
NEXT_PUBLIC_VAPI_ASSISTANT_ID=your-actual-assistant-id-here
```

### 4. Run the Application
```bash
npm run dev
```

## How It Works:
- Click the "Start Voice Chat" button to begin a conversation
- The AI will use your specific assistant configuration from the dashboard
- Any changes you make to the assistant in the dashboard will automatically apply
- Click "End Call" to stop the conversation

## Benefits of Using Assistant ID:
- ✅ **Centralized Management**: Change prompts, voice, model from dashboard
- ✅ **No Code Changes**: Update assistant behavior without touching code
- ✅ **Version Control**: Track assistant changes in dashboard
- ✅ **Multiple Assistants**: Easily switch between different assistants
- ✅ **Real-time Updates**: Changes apply immediately
- ✅ **Environment-based**: Manage assistant ID in .env file

## Features:
- ✅ Simple one-button voice interface
- ✅ Real-time voice conversation
- ✅ Clean, minimal UI
- ✅ Error handling and loading states
- ✅ Automatic call management
- ✅ Dashboard-managed assistant configuration
- ✅ Environment variable configuration

## Troubleshooting:
- Make sure your microphone permissions are enabled
- Check that your API key is correctly set in `.env.local`
- Verify your assistant ID is correct in `.env.local`
- Ensure you have a stable internet connection
- If you get errors, check the browser console for details

## Next Steps:
- Customize your assistant's personality in the Vapi dashboard
- Add more sophisticated conversation flows
- Integrate with your own data or APIs
- Add call recording and analytics
- Create multiple assistants for different use cases 