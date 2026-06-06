# Voice Tracking Demo - Text Rendering and Highlighting

## Current Implementation Status

The voice tracking functionality is fully implemented with proper text rendering and highlighting:

### 1. Text Rendering System
- **Character-level rendering**: Each character is rendered individually as a `<span>` element
- **Clause-based organization**: Text is divided into clauses based on punctuation for efficient processing
- **Real-time updates**: Text content updates immediately when changed

### 2. Voice Tracking Highlighting
- **Active character highlighting**: Currently spoken character is highlighted in amber (`bg-amber-500`)
- **Read text indication**: Already spoken characters are grayed out (`color: '#4b5563'`)
- **Smooth transitions**: CSS transitions provide smooth visual feedback

### 3. Visual Feedback Elements
- **Voice status indicator**: Shows "聆听中..." when voice mode is active
- **Active word highlighting**: Additional yellow background for the current word
- **Auto-scrolling**: Viewport automatically scrolls to keep active text centered

## How to Test the Functionality

1. **Start the application**: `npm run dev`
2. **Open browser**: Navigate to `http://localhost:3000`
3. **Enter text**: Click and type or paste some text content
4. **Enable voice mode**: Click the microphone button in the control panel
5. **Grant permission**: Allow browser microphone access
6. **Start speaking**: Observe the real-time highlighting:
   - Current character turns amber
   - Spoken characters turn gray
   - Viewport scrolls to keep active text visible
   - Voice status shows "聆听中..."

## Technical Implementation Details

### Character Rendering
```jsx
{clauses.map((clause) => (
    <span key={clause.id} data-clause-idx={clause.id} className="inline">
        {clause.segIndices.map((segIdx) => {
            const seg = segments[segIdx];
            const isRead = readIndicesState.has(seg.normIndex);
            const isActive = seg.isWordChar && seg.normIndex === matchedIndexState;

            let className = "transition-all duration-150 ease-in-out";
            let style = {};

            if (isRead) {
                style = { color: '#4b5563' }; // Gray for read characters
            }

            if (isActive) {
                className += " bg-amber-500 text-black font-extrabold rounded shadow-lg scale-110 inline-block";
            }

            return (
                <span
                    key={segIdx}
                    data-active={isActive ? "true" : "false"}
                    className={className}
                    style={style}
                >
                    {seg.char}
                </span>
            );
        })}
    </span>
))}
```

### Voice Tracking Integration
- **Speech Recognition API**: Uses browser's built-in speech recognition
- **Levenshtein Distance**: Fuzzy matching algorithm for accurate text positioning
- **Real-time Positioning**: Automatically scrolls to keep active text in view
- **Error Handling**: Graceful degradation if speech recognition fails

## Expected Visual Results

1. **Normal State**: Text appears in white (or selected color)
2. **Active Character**: Current character has amber background and is slightly enlarged
3. **Read Characters**: Previously spoken characters appear in gray
4. **Voice Mode Indicator**: Top-right corner shows listening status
5. **Smooth Scrolling**: Viewport follows your speech position automatically

The system is fully functional and provides excellent visual feedback for voice tracking.