/**
 * Ritual Builder - Custom Ritual Creation
 * Drag-and-drop interface for Core/Studio users
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DndContext, closestCenter } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Plus, Trash2, Save, ArrowLeft, GripVertical, Sparkles } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import toast from 'react-hot-toast';
import { useRitualStore } from '../hooks/useRitualStore';
import { useTierQuery } from '@/hooks/useTierQuery';
import { useUpgradeModals } from '@/contexts/UpgradeModalContext';
import { StepLibrary, STEP_TYPE_DEFINITIONS } from './StepLibrary';
import { StepConfigPanel } from './StepConfigPanel';
import type { RitualStep, RitualGoal, RitualStepType } from '../types/rituals';
import { logger } from '@/lib/logger';

interface SortableStepCardProps {
  step: RitualStep;
  index: number;
  onEdit: (step: RitualStep) => void;
  onDelete: (stepId: string) => void;
}

const SortableStepCard: React.FC<SortableStepCardProps> = ({ step, index, onEdit, onDelete }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: step.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const stepDef = STEP_TYPE_DEFINITIONS[step.type];
  const Icon = stepDef.icon;

  return (
    <div ref={setNodeRef} style={style} className="group">
      <div
        className={`flex items-center gap-3 p-4 bg-white rounded-lg border-2 ${stepDef.color} transition-all hover:shadow-md`}
      >
        {/* Drag Handle */}
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
        >
          <GripVertical size={20} />
        </button>

        {/* Step Number */}
        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-semibold text-gray-600">
          {index + 1}
        </div>

        {/* Icon */}
        <div className={`p-2 rounded-lg ${stepDef.color}`}>
          <Icon size={18} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0" onClick={() => onEdit(step)}>
          <div className="font-medium text-sm text-[#3B3632] truncate">{step.config.title}</div>
          <div className="text-xs text-gray-600">{step.duration} min</div>
        </div>

        {/* Delete Button */}
        <button
          onClick={() => onDelete(step.id)}
          className="flex-shrink-0 p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
          aria-label="Delete step"
        >
          <Trash2 size={18} />
        </button>
      </div>
    </div>
  );
};

export const RitualBuilder: React.FC = () => {
  const navigate = useNavigate();
  const { tier, userId } = useTierQuery();
  const { showGenericUpgrade } = useUpgradeModals();
  const { createRitual } = useRitualStore();

  const [title, setTitle] = useState('');
  const [goal, setGoal] = useState<RitualGoal>('focus');
  const [steps, setSteps] = useState<RitualStep[]>([]);
  const [selectedStep, setSelectedStep] = useState<RitualStep | null>(null);
  const [saving, setSaving] = useState(false);

  // Tier gate
  if (tier === 'free') {
    return (
      <div className="min-h-screen bg-[#F9F6F1] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl border-2 border-[#E8DCC8] p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-orange-50 flex items-center justify-center mx-auto mb-4">
            <Sparkles size={32} className="text-orange-600" />
          </div>
          <h2 className="text-2xl font-bold text-[#3B3632] mb-2">Unlock Custom Rituals</h2>
          <p className="text-gray-600 mb-6">
            Upgrade to <strong>Core</strong> to create personalized rituals tailored to your needs.
          </p>
          <button
            onClick={() => showGenericUpgrade('audio')}
            className="w-full px-6 py-3 bg-[#3B3632] text-white rounded-xl hover:bg-[#2A2621] transition-colors font-medium"
          >
            Upgrade to Core ($19.99)
          </button>
          <button
            onClick={() => navigate('/rituals')}
            className="mt-3 text-sm text-gray-600 hover:text-gray-800 underline"
          >
            Back to Ritual Library
          </button>
        </div>
      </div>
    );
  }

  const totalDuration = steps.reduce((sum, step) => sum + step.duration, 0);

  const handleAddStep = (stepType: RitualStepType) => {
    const stepDef = STEP_TYPE_DEFINITIONS[stepType];
    const newStep: RitualStep = {
      id: uuidv4(),
      type: stepType,
      duration: stepDef.defaultDuration,
      order: steps.length,
      config: {
        title: stepDef.label,
        instructions: stepDef.defaultInstructions,
      },
    };

    setSteps([...steps, newStep]);
    toast.success(`Added ${stepDef.label}`);
  };

  const handleDeleteStep = (stepId: string) => {
    setSteps(steps.filter((s) => s.id !== stepId));
    if (selectedStep?.id === stepId) {
      setSelectedStep(null);
    }
    toast.success('Step removed');
  };

  const handleUpdateStep = (updatedStep: RitualStep) => {
    setSteps(steps.map((s) => (s.id === updatedStep.id ? updatedStep : s)));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = steps.findIndex((s) => s.id === active.id);
      const newIndex = steps.findIndex((s) => s.id === over.id);

      const reordered = arrayMove(steps, oldIndex, newIndex).map((step, index) => ({
        ...step,
        order: index,
      }));

      setSteps(reordered);
    }
  };

  const handleSave = async () => {
    // Validation
    if (!title.trim()) {
      toast.error('Please enter a ritual title');
      return;
    }

    if (steps.length === 0) {
      toast.error('Add at least one step to your ritual');
      return;
    }

    if (!userId) {
      toast.error('You must be logged in to save rituals');
      return;
    }

    setSaving(true);
    const loadingToast = toast.loading('Saving ritual...');

    try {
      await createRitual({
        userId,
        title: title.trim(),
        goal,
        steps,
        isPreset: false,
        tierRequired: tier,
      });

      toast.dismiss(loadingToast);
      toast.success('✨ Ritual saved successfully!');
      navigate('/rituals');
    } catch (error) {
      logger.error('[RitualBuilder] Failed to save ritual:', error);
      toast.dismiss(loadingToast);
      toast.error('Failed to save ritual. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F9F6F1]">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/rituals')}
              className="p-2 hover:bg-white rounded-lg transition-colors"
            >
              <ArrowLeft size={24} className="text-[#3B3632]" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-[#3B3632]">Create Custom Ritual</h1>
              <p className="text-gray-600">Design your personalized micro-moment</p>
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={saving || steps.length === 0 || !title.trim()}
            className="flex items-center gap-2 px-6 py-3 bg-[#3B3632] text-white rounded-xl hover:bg-[#2A2621] disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            <Save size={20} />
            <span>{saving ? 'Saving...' : 'Save Ritual'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Step Library */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl border-2 border-[#E8DCC8] p-6 sticky top-4">
              <StepLibrary onStepSelect={handleAddStep} />
            </div>
          </div>

          {/* Center: Ritual Canvas */}
          <div className="lg:col-span-1 space-y-6">
            {/* Ritual Info */}
            <div className="bg-white rounded-xl border-2 border-[#E8DCC8] p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-[#3B3632] mb-2">
                  Ritual Title *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Morning Energy Boost"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#B2BDA3] focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#3B3632] mb-2">Goal</label>
                <select
                  value={goal}
                  onChange={(e) => setGoal(e.target.value as RitualGoal)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#B2BDA3] focus:border-transparent"
                >
                  <option value="energy">Energy</option>
                  <option value="calm">Calm</option>
                  <option value="focus">Focus</option>
                  <option value="creativity">Creativity</option>
                </select>
              </div>

              <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200 flex justify-between items-center">
                <span className="text-sm text-gray-600">Total Duration</span>
                <span className="text-lg font-bold text-[#3B3632]">{totalDuration} min</span>
              </div>
            </div>

            {/* Steps */}
            <div className="bg-white rounded-xl border-2 border-[#E8DCC8] p-6">
              <h3 className="text-sm font-semibold text-[#3B3632] uppercase tracking-wide mb-4">
                Your Ritual ({steps.length} steps)
              </h3>

              {steps.length === 0 ? (
                <div className="text-center py-12">
                  <Plus size={48} className="text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 text-sm">
                    Add steps from the library to build your ritual
                  </p>
                </div>
              ) : (
                <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={steps.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-3">
                      {steps.map((step, index) => (
                        <SortableStepCard
                          key={step.id}
                          step={step}
                          index={index}
                          onEdit={setSelectedStep}
                          onDelete={handleDeleteStep}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </div>
          </div>

          {/* Right: Config Panel */}
          <div className="lg:col-span-1">
            <div className="sticky top-4">
              {selectedStep ? (
                <StepConfigPanel
                  step={selectedStep}
                  onUpdate={handleUpdateStep}
                  onClose={() => setSelectedStep(null)}
                />
              ) : (
                <div className="bg-white rounded-xl border-2 border-[#E8DCC8] p-6 text-center">
                  <p className="text-gray-500 text-sm">
                    Click on a step to edit its duration and instructions
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

