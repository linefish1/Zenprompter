# Recorded Video Waterfall List Design Plan

## 1. UI/UX Design

### Location
The waterfall list will be displayed below the teleprompter card, within the main recording overlay. It should be scrollable horizontally on mobile devices, aligning with the existing draggable toolbar sections.

### List Structure
-   **Waterfall Layout**: Videos will be displayed in a horizontally scrolling list, similar to a waterfall or carousel, showing thumbnails of the recorded videos.
-   **Individual Video Item**: Each item in the list will represent a single recorded video.
    -   **Thumbnail**: A preview image/frame from the video.
    -   **Title/Timestamp**: Display the recording date and time.
    -   **Duration**: Show the length of the video.
    -   **Action Buttons (on hover/tap)**:
        -   **Play**: Icon to play the video (either in a modal or new tab).
        -   **Download**: Icon to download the video file to the local device.
        -   **Delete**: Icon to remove the video from the list.
    -   **Selection Indicator**: A checkbox or similar UI element for multi-selection for bulk deletion.

### Interaction
-   **Horizontal Scrolling**: The list itself should be horizontally scrollable to accommodate many videos, especially on smaller screens.
-   **Play Video**: Clicking the play icon will open the video for playback.
-   **Download Video**: Clicking the download icon will trigger the download of the video file.
-   **Delete Video**: Clicking the delete icon on an individual video will prompt for confirmation and then remove the video.
-   **Multi-select Delete**: A toggle or button to enter multi-select mode, allowing users to select multiple videos and then trigger a bulk delete action.

## 2. Data Structure

The existing `RecordedVideo` interface and related state in `RecordingOverlay.tsx` will be utilized:

```typescript
interface RecordedVideo {
  id: string;
  url: string; // Object URL for the Blob
  blob: Blob; // The actual video data
  timestamp: number;
  duration: number;
}
```
The `recordedVideosRef` (for mutable access in event handlers) and `recordedVideos` state (for React rendering) are already set up to manage this list.

## 3. Functionality Implementation

### Playing Videos
-   When the "Play" button is clicked, open the `video.url` in a new browser tab or a modal video player.
-   The current implementation uses `<a>` tag to open in a new tab which is sufficient for now.

### Downloading Videos
-   The `downloadRecording` utility function (or similar logic already in `handlePlayVideo` for `<a>` tag with `download` attribute) will be used.
-   Triggering the download will initiate saving the `video.blob` to the user's local file system.

### Deleting Videos (Single)
-   The `handleDeleteVideo` function in `RecordingOverlay.tsx` already handles single video deletion and revoking the Object URL. This will be integrated with the UI button.

### Deleting Videos (Multi-select)
-   **State for Selection**: A new state variable (e.g., `selectedVideos: Set<string>`) will be introduced to track selected video IDs.
-   **Toggle Multi-select Mode**: A button will switch between normal and multi-select modes. In multi-select mode, checkboxes appear on each video item.
-   **Select/Deselect**: Clicking a checkbox adds/removes the video ID from `selectedVideos`.
-   **Bulk Delete Button**: A button (e.g., "Delete Selected") becomes active when `selectedVideos` is not empty. Clicking it will iterate through `selectedVideos`, call `handleDeleteVideo` for each, and then clear the selection.

## 4. Implementation Steps (To be executed)

1.  **Modify `RecordingOverlay.tsx`**:
    *   Add state for `selectedVideos` and `isMultiSelectMode`.
    *   Create a new React component or section for the waterfall list.
    *   Render `recordedVideos` using the new UI design.
    *   Integrate play, download, and delete buttons for each video item.
    *   Implement multi-select checkboxes and a bulk delete button.
    *   Ensure responsiveness for mobile and desktop views, particularly for horizontal scrolling of the list.

2.  **CSS Styling**: Apply Tailwind CSS classes to achieve the desired look and feel for the waterfall list and its interactive elements.

This plan aims to integrate the new video gallery seamlessly into the existing `RecordingOverlay.tsx` component while providing the requested functionalities.