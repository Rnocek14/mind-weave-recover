/**
 * Intensity registry barrel — importing this file ensures every per-game
 * intensity config is registered. Banks/selectors should import from here
 * (or directly from `./gameIntensity`) — never the per-game file alone.
 */
export * from './gameIntensity';
import './photoNamingIntensity';
import './fixSentenceIntensity';
import './minimalPairsIntensity';
