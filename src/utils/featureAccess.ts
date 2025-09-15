export type Tier = 'free' | 'core' | 'studio';

type FeatureFlags = {
  text: boolean;
  audio: boolean;
  image: boolean;
  persistent_memory: boolean;
  priority_processing: boolean;
  limits?: {
    textMessages?: number;
    audioMinutes?: number;
    imageUploads?: number;
  };
};

export const tierFeatures: Record<Tier, FeatureFlags> = {
  free: {
    text: true,
    audio: false,
    image: false,
    persistent_memory: false,
    priority_processing: false,
    limits: { 
      textMessages: 15,
      audioMinutes: 0,
      imageUploads: 0
    },
  },
  core: {
    text: true,
    audio: true,
    image: true,
    persistent_memory: true,
    priority_processing: false,
    limits: { 
      textMessages: -1, // Unlimited
      audioMinutes: 60,
      imageUploads: 10
    },
  },
  studio: {
    text: true,
    audio: true,
    image: true,
    persistent_memory: true,
    priority_processing: true,
    limits: { 
      textMessages: -1, // Unlimited
      audioMinutes: -1, // Unlimited
      imageUploads: -1 // Unlimited
    },
  },
};
