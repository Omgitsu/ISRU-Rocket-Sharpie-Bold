#!/usr/bin/env node

/**
 * OpenType Pseudorandom CALT Feature Compiler (Node.js Version)
 * ------------------------------------------------------------------------------
 * Converted from Nic Schumann's Python implementation of Tal Leming's
 * "Quantum" Pseudorandom OpenType feature.
 * 
 * 
 * Usage: node compiler.js > output.fea
 * ------------------------------------------------------------------------------
 */

// Set a fixed seed for deterministic results
// Change this number to get different random distributions
const RANDOM_SEED = 0;

// The DEPTH parameter controls the distance of the lookahead
// Greater depth = longer-range triggers but more rendering work
const DEPTH = 10;

// Number of random partitions for pseudo-random seeds
// More partitions = different randomness texture
const PARTITIONS = 4;

// Define base glyphs and their alternates
// Create non-overlapping transformation sets to avoid duplicate substitutions

// Base uppercase and lowercase
const base = [
    'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
    'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
    'zero','one','two','three','four','five','six','seven','eight','nine',
];

// .ss01 variants only
const variation_1 = [
    'a.ss01', 'b.ss01', 'c.ss01', 'd.ss01', 'e.ss01', 'f.ss01', 'g.ss01', 'h.ss01',
    'i.ss01', 'j.ss01', 'k.ss01', 'l.ss01', 'm.ss01', 'n.ss01', 'o.ss01', 'p.ss01',
    'q.ss01', 'r.ss01', 's.ss01', 't.ss01', 'u.ss01', 'v.ss01', 'w.ss01', 'x.ss01',
    'y.ss01', 'z.ss01',
    'zero.ss01','one.ss01','two.ss01','three.ss01','four.ss01','five.ss01','six.ss01','seven.ss01','eight.ss01','nine.ss01',
];

// .ss02 variants only
const variation_2 = [
    'a.ss02', 'b.ss02', 'c.ss02', 'd.ss02', 'e.ss02', 'f.ss02', 'g.ss02', 'h.ss02',
    'i.ss02', 'j.ss02', 'k.ss02', 'l.ss02', 'm.ss02', 'n.ss02', 'o.ss02', 'p.ss02',
    'q.ss02', 'r.ss02', 's.ss02', 't.ss02', 'u.ss02', 'v.ss02', 'w.ss02', 'x.ss02',
    'y.ss02', 'z.ss02',
    'zero.ss02','one.ss02','two.ss02','three.ss02','four.ss02','five.ss02','six.ss02','seven.ss02','eight.ss02','nine.ss02',
];

// .ss03 variants only
const variation_3 = [
    'a.ss03', 'b.ss03', 'c.ss03', 'd.ss03', 'e.ss03', 'f.ss03', 'g.ss03', 'h.ss03',
    'i.ss03', 'j.ss03', 'k.ss03', 'l.ss03', 'm.ss03', 'n.ss03', 'o.ss03', 'p.ss03',
    'q.ss03', 'r.ss03', 's.ss03', 't.ss03', 'u.ss03', 'v.ss03', 'w.ss03', 'x.ss03',
    'y.ss03', 'z.ss03',
    'zero.ss03','one.ss03','two.ss03','three.ss03','four.ss03','five.ss03','six.ss03','seven.ss03','eight.ss03','nine.ss03'
];

// All glyphs that will be used in the feature (base + .ss01 + .ss02 + .ss03)
const allExportingGlyphs = [...base, ...variation_1, ...variation_2, ...variation_3];

// Transition states - simplified to avoid duplicates
const transitions = [base, variation_1, variation_2, variation_3];

// Simple seeded random number generator
class SeededRandom {
    constructor(seed) {
        this.seed = seed;
    }
    
    next() {
        this.seed = (this.seed * 9301 + 49297) % 233280;
        return this.seed / 233280;
    }
    
    randrange(max) {
        return Math.floor(this.next() * max);
    }
}

const rng = new SeededRandom(RANDOM_SEED);

function generateClassDefinitionKvpair([i, glyphs]) {
    return [`@transformation${i}`, `[${glyphs.join(' ')}]`];
}

function generateStateDefinitions(transitions) {
    return transitions.map((glyphs, i) => generateClassDefinitionKvpair([i, glyphs]));
}

function generatePermutationDefinitionsFromStates(states) {
    const classes = states.map(p => p[0]);
    return classes.map((_, i) => {
        const rotated = [...classes.slice(i), ...classes.slice(0, i)];
        return [`@state${i}`, `[${rotated.join(' ')}]`];
    });
}

function generateCharsetPartitions(glyphs, k = 2) {
    const glyphsCopy = [...glyphs];
    const partitions = Array.from({length: k}, (_, i) => [`@partition${i}`, []]);
    
    const groupSize = Math.floor(glyphsCopy.length / k);
    
    for (let g = 0; g < groupSize; g++) {
        for (let p = 0; p < partitions.length && glyphsCopy.length > 0; p++) {
            const randomIndex = rng.randrange(glyphsCopy.length);
            partitions[p][1].push(glyphsCopy.splice(randomIndex, 1)[0]);
        }
    }
    
    return partitions.map(p => [p[0], `[${p[1].sort().join(' ')}]`]);
}

function generateAll(glyphs) {
    // return [['@All', `[${glyphs.join(' ')}]`]];
    return [['@All', `[${[...new Set(glyphs)].join(' ')}]`]];
}

function generateSkip() {
    return [['@skip', '[@All]']];
}

function generateLookups(permutations, partitions, skip, depth = 1) {
    const lookups = [];
    const pNames = [...permutations.map(p => p[0]), permutations[0][0]];
    const pMap = Array.from({length: pNames.length - 1}, (_, i) => [pNames[i], pNames[i + 1]]);
    
    for (let d = 0; d < depth; d++) {
        lookups.push([]);
        for (let i = 0; i < pMap.length; i++) { 
            const partitionIndex = i % partitions.length; 
            const partition = partitions[partitions.length - 1 - partitionIndex];
            lookups[d].push([
                `skip${d}_partition${i}`,
                partition[0],
                Array(d).fill(skip[0][0]),
                pMap[i][0], 
                pMap[i][1]
            ]);
        }
    }
    
    return lookups;
}

function compileClassDefinition(data, indent = '') {
    return data.reduce((acc, [name, definition]) => 
        acc + `${indent}${name} = ${definition};\n`, '');
}

function compileLookupDefinitions(data, indent = '') {
    function compileLookup([name, partition, skips, fromState, toState]) {
        let definition = `${indent}lookup ${name} {\n`;
        definition += `${indent}\tsub ${partition} ${skips.join(' ')} ${fromState}' by ${toState};\n`;
        definition += `${indent}} ${name};\n\n`;
        return definition;
    }
    
    return data.reverse().map(lookupSet => 
        lookupSet.reduce((acc, lookup) => acc + compileLookup(lookup), '')
    ).join('\n\n');
}

function compileFeatureBody(transitions, allGlyphs, depth = DEPTH, partitions = PARTITIONS, indent = '') {
    const S = generateStateDefinitions(transitions);
    const T = generatePermutationDefinitionsFromStates(S);
    const P = generateCharsetPartitions(allGlyphs, partitions);
    const ALL = generateAll(allGlyphs);
    const SKIP = generateSkip();
    const LOOKUPS = generateLookups(T, P, SKIP, depth);
    
    const program = [
        compileClassDefinition(S, indent),
        compileClassDefinition(T, indent),
        compileClassDefinition(P, indent),
        compileClassDefinition(ALL, indent), 
        compileClassDefinition(SKIP, indent),
        compileLookupDefinitions(LOOKUPS, indent)
    ].join('\n');
    
    return program;
}

function compileFeature(transitions, allGlyphs, depth = DEPTH, partitions = PARTITIONS, indent = '') {
    let program = 'feature calt {\n\n';
    program += compileFeatureBody(transitions, allGlyphs, depth, partitions, indent + '\t');
    program += '\n} calt;';
    return program;
}

// Output the feature code
console.log('# OpenType Pseudorandom CALT Feature');
console.log('# Generated for FontLab 8');
console.log('# Copy this code into your font\'s calt feature\n');
console.log(compileFeature(transitions, allExportingGlyphs));