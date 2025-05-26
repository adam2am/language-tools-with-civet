import { strict as assert } from 'assert';
import { preprocessCivet } from '../../src/svelte2tsx/utils/civetPreprocessor';
import { SourceMapConsumer } from 'source-map';
import fs from 'fs';
import path from 'path';

describe('current preprocessCivet on real fixtures', () => {
  const fixturesDir = path.join(__dirname, 'fixtures');
  const fixtureFiles = fs.readdirSync(fixturesDir).filter(f => f.endsWith('.svelte'));
  for (const fixtureFile of fixtureFiles) {
    it(`${fixtureFile} should have valid mappings`, async () => {
      const fixturePath = path.join(fixturesDir, fixtureFile);
      const svelte = fs.readFileSync(fixturePath, 'utf8');
      const result = preprocessCivet(svelte, fixtureFile);
      // If no civet blocks present, expect no preprocessing result
      const hasCivet = /<script\s[^>]*lang=["']civet["']/.test(svelte);
      if (!hasCivet) {
        assert.strictEqual(result.module, undefined, `Expected no module mapping for ${fixtureFile}`);
        assert.strictEqual(result.instance, undefined, `Expected no instance mapping for ${fixtureFile}`);
        return;
      }
      // Validate module script mappings if present
      if (result.module) {
        const { map: mMap } = result.module!;
        const mCons = await new SourceMapConsumer(mMap);
        let mCount = 0;
        mCons.eachMapping(m => {
          assert.equal(m.source, fixtureFile);
          assert.ok(typeof m.originalLine === 'number' && m.originalLine >= 1);
          assert.ok(typeof m.originalColumn === 'number' && m.originalColumn >= 0);
          mCount++;
        });
        assert.ok(mCount > 0, 'Expected at least one module mapping');
        mCons.destroy();
      }
      // Validate instance script mappings
      assert.ok(result.instance, 'Expected instance block');
      const { map: iMap } = result.instance!;
      const iCons = await new SourceMapConsumer(iMap);
      let iCount = 0;
      iCons.eachMapping(m => {
        assert.equal(m.source, fixtureFile);
        assert.ok(typeof m.originalLine === 'number' && m.originalLine >= 1);
        assert.ok(typeof m.originalColumn === 'number' && m.originalColumn >= 0);
        iCount++;
      });
      assert.ok(iCount > 0, 'Expected at least one instance mapping');
      iCons.destroy();
    });
  }
}); 