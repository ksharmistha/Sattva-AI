/**
 * Drives the ExercisesScreen state machines with fake timers.
 *
 * The box-breathing timer is the demo's most visible interactive feature and
 * had never been exercised beyond "it renders". These tests advance real timer
 * ticks and assert the phase sequence, round counting and completion.
 */
import React from 'react';
import renderer, { act } from 'react-test-renderer';

jest.mock('@expo/vector-icons', () => {
  const ReactLib = require('react');
  const { View } = require('react-native');
  const Icon = (props) => ReactLib.createElement(View, { testID: `icon-${props.name}` });
  return new Proxy({}, { get: () => Icon });
});

const ExercisesScreen = require('../ExercisesScreen').default;

/** Collects every rendered Text node's string content. */
const textOf = (tree) => {
  const out = [];
  const walk = (node) => {
    if (node == null) return;
    if (typeof node === 'string') { out.push(node); return; }
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (node.children) node.children.forEach(walk);
  };
  walk(tree.toJSON());
  return out.join(' ');
};

/**
 * Finds a pressable whose subtree text matches and invokes onPress.
 * `exact` matters for the round chips - a substring match on "2" also hits "12".
 */
const pressByLabel = async (tree, label, { exact = false } = {}) => {
  const candidates = tree.root.findAll(
    (n) => typeof n.props?.onPress === 'function' && n.props?.accessible !== false,
    { deep: true }
  );
  const match = candidates.reverse().find((n) => {
    const strings = [];
    const walk = (c) => {
      if (typeof c === 'string') strings.push(c);
      else if (Array.isArray(c)) c.forEach(walk);
      else if (c?.children) c.children.forEach(walk);
    };
    walk(n.children);
    const text = strings.join(' ').trim();
    return exact ? text === label : text.includes(label);
  });
  if (!match) throw new Error(`No pressable ${exact ? 'exactly matching' : 'containing'} "${label}"`);
  await act(async () => { match.props.onPress(); });
  return match;
};

describe('Box Breathing timer', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => { jest.runOnlyPendingTimers(); jest.useRealTimers(); });

  const openBreathing = async () => {
    let tree;
    await act(async () => { tree = renderer.create(<ExercisesScreen />); });
    await pressByLabel(tree, 'Box Breathing');
    return tree;
  };

  it('opens the breathing panel in the Ready state', async () => {
    const tree = await openBreathing();
    expect(textOf(tree)).toContain('Ready');
    expect(textOf(tree)).toContain('Round:');
  });

  it('starts and advances through the box-breathing phases', async () => {
    const tree = await openBreathing();
    await pressByLabel(tree, 'Start');

    // Ready -> Inhale after the first 4-second countdown elapses.
    await act(async () => { jest.advanceTimersByTime(4000); });
    expect(textOf(tree)).toContain('Inhale');

    await act(async () => { jest.advanceTimersByTime(4000); });
    expect(textOf(tree)).toContain('Hold (Full)');

    await act(async () => { jest.advanceTimersByTime(4000); });
    expect(textOf(tree)).toContain('Exhale');
  });

  it('counts rounds and finishes after the configured number', async () => {
    const tree = await openBreathing();
    await pressByLabel(tree, '2', { exact: true }); // 2 rounds
    await pressByLabel(tree, 'Start');

    expect(textOf(tree)).toContain('Round:  1  /  2');

    // Ready->Inhale->Hold(Full)->Exhale then round 2's four phases: 8 ticks.
    await act(async () => { jest.advanceTimersByTime(4000 * 4); });
    expect(textOf(tree)).toContain('Round:  2  /  2');

    await act(async () => { jest.advanceTimersByTime(4000 * 4); });
    expect(textOf(tree)).toContain('Finished');
  });

  it('pauses without advancing further', async () => {
    const tree = await openBreathing();
    await pressByLabel(tree, 'Start');
    await act(async () => { jest.advanceTimersByTime(4000); });
    expect(textOf(tree)).toContain('Inhale');

    await pressByLabel(tree, 'Pause');
    await act(async () => { jest.advanceTimersByTime(20000); });
    expect(textOf(tree)).toContain('Inhale'); // unchanged while paused
  });

  it('clears its interval on unmount (no leaked timers)', async () => {
    const tree = await openBreathing();
    await pressByLabel(tree, 'Start');
    await act(async () => { jest.advanceTimersByTime(2000); });
    await act(async () => { tree.unmount(); });
    expect(jest.getTimerCount()).toBe(0);
  });
});

describe('Meditation timer', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => { jest.runOnlyPendingTimers(); jest.useRealTimers(); });

  it('counts down once started', async () => {
    let tree;
    await act(async () => { tree = renderer.create(<ExercisesScreen />); });
    await pressByLabel(tree, 'Mindfulness Meditation');

    const before = textOf(tree);
    expect(before).toMatch(/\d+:\d{2}/); // shows a mm:ss clock

    await pressByLabel(tree, 'Start');
    await act(async () => { jest.advanceTimersByTime(5000); });

    expect(textOf(tree)).toMatch(/\d+:\d{2}/);
    expect(textOf(tree)).not.toBe(before);
  });
});
