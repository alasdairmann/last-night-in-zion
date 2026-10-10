// Layout auto-detection (Mobile & Touch PRD, "Automatic rule").
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { autoMode } from '../src/layout.js';

test('844x390 phone in landscape is Mobile', () => assert.equal(autoMode(844, 390, true), 'mobile'));
test('1440x900 desktop is Desktop', () => assert.equal(autoMode(1440, 900, false), 'desktop'));
test('1366x768 laptop is Desktop (scale 2)', () => assert.equal(autoMode(1366, 768, false), 'desktop'));
test('1024x768 iPad in landscape is Tablet', () => assert.equal(autoMode(1024, 768, true), 'tablet'));
test('1180x820 iPad Air is Tablet', () => assert.equal(autoMode(1180, 820, true), 'tablet'));
test('a 900x480 window is Mobile even with a mouse (short side under 500)', () => assert.equal(autoMode(900, 480, false), 'mobile'));
test('scale under 2 is Mobile', () => assert.equal(autoMode(959, 600, false), 'mobile'));
