import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { loadConfig, getAllAgents, getPhaseOrder } from '../src/config-loader.mjs';

// Set a dummy API key so config validation passes in tests.
let _originalKey;
before(() => { _originalKey = process.env.ANTHROPIC_API_KEY; process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key'; });
after(() => { process.env.ANTHROPIC_API_KEY = _originalKey; });

describe('loadConfig', () => {
  it('loads default config with no arguments', () => {
    const config = loadConfig({});
    assert.ok(config, 'should return a config object');
    assert.ok(config.pipeline, 'config should have pipeline');
    assert.ok(config.pipeline.phases, 'pipeline should have phases');
    assert.ok(Array.isArray(config.pipeline.phases), 'phases should be an array');
    assert.ok(config.pipeline.phases.length > 0, 'should have at least one phase');
  });

  it('loads a named preset', () => {
    const config = loadConfig({ preset: 'pharmacogenomics' });
    assert.ok(config, 'should return a config object');
    assert.ok(config.pipeline.phases.length > 0, 'preset should define phases');
  });

  it('applies CLI overrides', () => {
    const config = loadConfig({ model: 'opus', costLimit: '5.00' });
    assert.ok(config, 'should return a config object');
  });

  it('throws on unknown preset', () => {
    assert.throws(
      () => loadConfig({ preset: 'nonexistent-preset-xyz' }),
      /preset/i,
      'should throw an error mentioning preset'
    );
  });
});

describe('getAllAgents', () => {
  it('returns all agents across all phases', () => {
    const config = loadConfig({});
    const agents = getAllAgents(config);
    assert.ok(Array.isArray(agents), 'should return array');
    assert.ok(agents.length > 0, 'default config should have agents');
    for (const agent of agents) {
      assert.ok(agent.id, 'each agent should have an id');
      assert.ok(agent.role, 'each agent should have a role');
    }
  });
});

describe('getPhaseOrder', () => {
  it('returns phases in pipeline order', () => {
    const config = loadConfig({});
    const phases = getPhaseOrder(config);
    assert.ok(Array.isArray(phases), 'should return array');
    assert.ok(phases.length > 0, 'should have at least one phase');
    for (const phase of phases) {
      assert.ok(phase.id, 'each phase should have an id');
    }
  });
});
