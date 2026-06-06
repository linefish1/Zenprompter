import React from 'react';
import { CameraIcon } from '@heroicons/react/24/solid';

interface StartRecordingButtonProps {
  onClick: () => void;
  isRecording?: boolean;
}

const StartRecordingButton: React.FC<StartRecordingButtonProps> = ({ onClick, isRecording = false }) => {
  return (
    <button
      onClick={onClick}
      className={`fixed bottom-4 right-16 z-50 ${isRecording ? 'bg-red-500 hover:bg-red-700' : 'bg-blue-500 hover:bg-blue-700'} text-white font-bold p-2 rounded-full shadow-lg`}
      aria-label={isRecording ? '停止拍摄' : '开始拍摄'}
    >
      <CameraIcon className="h-5 w-5" />
    </button>
  );
};

export default StartRecordingButton;