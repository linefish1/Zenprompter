import React, { useState } from 'react';

const ZoomSelector = ({ currentZoom, onZoomChange }) => {
  // 定义变焦数列，例如从-2到2，步长0.5
  // Define a zoom sequence, for example from -2 to 2 with a step of 0.5
  const zoomLevels = [-2, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2];

  return (
    <div className="relative z-10 p-2 bg-gray-100 rounded-md shadow-lg">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        当前变焦 (Current Zoom):
      </label>
      <div className="flex flex-wrap gap-2 justify-center">
        {zoomLevels.map((level) => (
          <button
            key={level}
            type="button"
            onClick={() => onZoomChange(level)}
            className={`
              px-3 py-1 text-sm rounded-md border
              ${currentZoom === level
                ? 'bg-blue-600 text-white border-blue-700 shadow-sm'
                : 'bg-white text-gray-800 border-gray-300 hover:bg-gray-50'}
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
            `}
          >
            {level >= 0 ? `+${level}x` : `${level}x`}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-gray-500">
        已选择: {currentZoom >= 0 ? `+${currentZoom}x` : `${currentZoom}x`}
      </p>
    </div>
  );
};

export default ZoomSelector;
