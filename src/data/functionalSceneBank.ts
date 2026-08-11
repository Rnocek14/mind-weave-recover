/**
 * Functional Command Scenes — v1 scene bank
 * (docs/functional-command-scenes-spec.md).
 *
 * Six scenes on existing photo assets. Adult presentation: real objects,
 * physical effects. Vocabulary targets core words (stop/go/more/up) and
 * comparatives (bigger/brighter/faster) — base forms accepted and logged.
 *
 * AI-authored — on the SLP-review pile with the other banks.
 */
import type { SceneDefinition } from '@/lib/scenes/sceneEngine';
import lampImg from '@/assets/photos/lamp.jpg';
import ballImg from '@/assets/photos/ball.jpg';
import birdImg from '@/assets/photos/bird.jpg';
import carImg from '@/assets/photos/car.jpg';
import cupImg from '@/assets/photos/cup.jpg';
import candleImg from '@/assets/photos/candle.jpg';

export const FUNCTIONAL_SCENES: SceneDefinition[] = [
  {
    id: 'lamp',
    title: 'The Lamp',
    prompt: 'Tell the lamp what to do.',
    photo: lampImg,
    axes: [{ key: 'brightness', type: 'step', min: 0, max: 4, initial: 2 }],
    commands: [
      { word: 'brighter', baseForms: ['bright'], aliases: ['lighter'], axis: 'brightness', delta: 1 },
      { word: 'darker', baseForms: ['dark'], aliases: ['dimmer', 'dim'], axis: 'brightness', delta: -1 },
    ],
    feedback: {
      brighter: 'The lamp is brighter.',
      darker: 'The lamp is darker.',
    },
    limitFeedback: {
      brightness_max: "That's as bright as it goes.",
      brightness_min: "That's as dark as it goes.",
    },
  },
  {
    id: 'ball',
    title: 'The Ball',
    prompt: 'Change the size of the ball.',
    photo: ballImg,
    axes: [{ key: 'size', type: 'step', min: 0, max: 4, initial: 2 }],
    commands: [
      { word: 'bigger', baseForms: ['big'], aliases: ['larger', 'large'], axis: 'size', delta: 1 },
      { word: 'smaller', baseForms: ['small'], aliases: ['littler', 'little'], axis: 'size', delta: -1 },
    ],
    feedback: {
      bigger: 'The ball is bigger.',
      smaller: 'The ball is smaller.',
    },
    limitFeedback: {
      size_max: "That's as big as it goes.",
      size_min: "That's as small as it goes.",
    },
  },
  {
    id: 'bird',
    title: 'The Bird',
    prompt: 'Move the bird up or down.',
    photo: birdImg,
    axes: [{ key: 'height', type: 'step', min: 0, max: 4, initial: 2 }],
    commands: [
      { word: 'up', aliases: ['higher', 'rise'], axis: 'height', delta: 1 },
      { word: 'down', aliases: ['lower'], axis: 'height', delta: -1 },
    ],
    feedback: {
      up: 'The bird flies up.',
      down: 'The bird comes down.',
    },
    limitFeedback: {
      height_max: "The bird can't go any higher.",
      height_min: 'The bird is on the ground.',
    },
  },
  {
    id: 'car',
    title: 'The Car',
    prompt: 'Drive the car with your words.',
    photo: carImg,
    axes: [
      { key: 'moving', type: 'toggle', initial: false },
      { key: 'speed', type: 'step', min: 1, max: 3, initial: 2 },
    ],
    commands: [
      { word: 'go', aliases: ['drive', 'start'], axis: 'moving', set: true },
      { word: 'stop', aliases: ['halt', 'brake'], axis: 'moving', set: false },
      { word: 'faster', baseForms: ['fast'], aliases: ['quicker', 'speed up'], axis: 'speed', delta: 1 },
      { word: 'slower', baseForms: ['slow'], aliases: ['slow down'], axis: 'speed', delta: -1 },
    ],
    feedback: {
      go: 'The car is going.',
      stop: 'The car stopped.',
      faster: 'The car speeds up.',
      slower: 'The car slows down.',
    },
    limitFeedback: {
      moving_max: 'The car is already going.',
      moving_min: 'The car is already stopped.',
      speed_max: "That's as fast as it goes.",
      speed_min: "That's as slow as it goes.",
    },
  },
  {
    id: 'cup',
    title: 'The Cup',
    prompt: 'Fill the cup, or empty it.',
    photo: cupImg,
    axes: [{ key: 'fill', type: 'step', min: 0, max: 4, initial: 2 }],
    commands: [
      { word: 'more', aliases: ['fill', 'fill it'], axis: 'fill', delta: 1 },
      { word: 'less', aliases: ['empty', 'pour out'], axis: 'fill', delta: -1 },
    ],
    feedback: {
      more: 'More in the cup.',
      less: 'Less in the cup.',
    },
    limitFeedback: {
      fill_max: 'The cup is full.',
      fill_min: 'The cup is empty.',
    },
  },
  {
    id: 'candle',
    title: 'The Candle',
    prompt: 'Light the candle, or blow it out.',
    photo: candleImg,
    axes: [{ key: 'lit', type: 'toggle', initial: true }],
    commands: [
      { word: 'light', aliases: ['light it', 'on'], axis: 'lit', set: true },
      { word: 'out', aliases: ['blow', 'blow it out', 'off'], axis: 'lit', set: false },
    ],
    feedback: {
      light: 'The candle is lit.',
      out: 'The candle is out.',
    },
    limitFeedback: {
      lit_max: 'The candle is already lit.',
      lit_min: 'The candle is already out.',
    },
  },
];
