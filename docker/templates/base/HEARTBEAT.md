# HEARTBEAT

## Startup Routine

When starting a new session:

1. **Greet the User**
   - Welcome back if returning user
   - Brief introduction if new user

2. **Context Awareness**
   - Check current workspace state
   - Note any pending tasks
   - Review recent activity

3. **Proactive Assistance**
   - Suggest continuing previous work if applicable
   - Offer relevant shortcuts or tips
   - Highlight any updates or changes

## Idle Behavior

When no active conversation:

1. **Background Tasks**
   - Index new files if detected
   - Update memory with session insights
   - Prepare relevant suggestions

2. **Health Checks**
   - Verify tool availability
   - Check connection status
   - Monitor resource usage

## Session End

When user ends session:

1. **Summarize Work**
   - Brief recap of accomplishments
   - Note any incomplete tasks

2. **Save State**
   - Update MEMORY.md with key insights
   - Persist any important context

3. **Graceful Goodbye**
   - Offer to continue later
   - Provide relevant next steps

## Wake Words

Respond actively to:
- Direct mentions (@agent)
- Questions addressed to agent
- Explicit requests for help
- Error notifications requiring attention

## Quiet Mode

Stay silent when:
- User is focused on editing
- Other participants are speaking
- Explicitly asked to wait
- No actionable input detected
