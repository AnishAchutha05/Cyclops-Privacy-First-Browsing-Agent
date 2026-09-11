export const MODEL_INPUT_NAME = 'images';
export const MODEL_OUTPUT_NAME = 'output0';

export const MODEL_SIZE = 640;
export const MODEL_CHANNELS = 3;
export const MODEL_OUTPUT_CHANNELS = 14;
export const MODEL_ANCHORS = 8400;

export const CONFIDENCE_THRESHOLD = 0.25;
export const NMS_IOU_THRESHOLD = 0.45;

export const CYCLOPS_CLASSES = [
  'Button',
  'Text Input',
  'Search Field',
  'Checkbox',
  'Select',
  'Link',
  'Menu',
  'Tab',
  'Utility Button',
  'Page control'
] as const;

export type CyclopsClassName = (typeof CYCLOPS_CLASSES)[number];

export interface Detection {
  classId: number;
  className: string;
  confidence: number;
  bbox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}
