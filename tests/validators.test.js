const test = require('node:test');
const assert = require('node:assert/strict');
const {
  isValidContact, isValidChannel, isValidOtpCode, sanitizeString, validateLeadPayload,
} = require('../validators');

test('isValidContact — mobile', () => {
  assert.equal(isValidContact('9339609665', 'mobile'), true);
  assert.equal(isValidContact('1234567890', 'mobile'), false); // must start 6-9
  assert.equal(isValidContact('93396096', 'mobile'), false);   // too short
  assert.equal(isValidContact('abcdefghij', 'mobile'), false);
});

test('isValidContact — email', () => {
  assert.equal(isValidContact('yogeshshuklalic@yahoo.com', 'email'), true);
  assert.equal(isValidContact('not-an-email', 'email'), false);
  assert.equal(isValidContact('missing@domain', 'email'), false);
});

test('isValidChannel only accepts mobile/email', () => {
  assert.equal(isValidChannel('mobile'), true);
  assert.equal(isValidChannel('email'), true);
  assert.equal(isValidChannel('sms'), false);
  assert.equal(isValidChannel(undefined), false);
});

test('isValidOtpCode requires exactly 6 digits', () => {
  assert.equal(isValidOtpCode('123456'), true);
  assert.equal(isValidOtpCode('12345'), false);
  assert.equal(isValidOtpCode('12345a'), false);
  assert.equal(isValidOtpCode(123456), false); // must be a string
});

test('sanitizeString strips control chars and clamps length', () => {
  assert.equal(sanitizeString('  hello  '), 'hello');
  assert.equal(sanitizeString('a\x00b\x1Fc'), 'abc');
  assert.equal(sanitizeString('x'.repeat(300), 10), 'x'.repeat(10));
  assert.equal(sanitizeString(null), '');
});

test('validateLeadPayload accepts a valid Life Insurance payload', () => {
  const result = validateLeadPayload({
    vertical: 'Life Insurance', category: 'Pure Protection', planNo: '954',
    planName: "LIC's New Tech-Term", investAmount: '1000000', tenure: '20',
    frequency: 'Monthly', actionType: 'Request Quote', note: 'Call after 6pm',
  });
  assert.equal(result.valid, true);
  assert.equal(result.data.investAmount, 1000000);
  assert.equal(result.data.tenure, 20);
});

test('validateLeadPayload rejects unknown vertical', () => {
  const result = validateLeadPayload({ vertical: 'Crypto Trading', category: 'X', planName: 'Y', actionType: 'Request Quote' });
  assert.equal(result.valid, false);
  assert.match(result.error, /vertical must be one of/);
});

test('validateLeadPayload rejects category not matching the vertical', () => {
  const result = validateLeadPayload({
    vertical: 'Life Insurance', category: 'Family Floater', // this belongs to Health Insurance
    planName: 'Some Plan', actionType: 'Request Quote',
  });
  assert.equal(result.valid, false);
  assert.match(result.error, /category must be one of/);
});

test('validateLeadPayload rejects invalid actionType', () => {
  const result = validateLeadPayload({
    vertical: 'Motor Insurance', category: 'Private Car', planName: 'Comprehensive', actionType: 'Buy Now',
  });
  assert.equal(result.valid, false);
  assert.match(result.error, /actionType must be one of/);
});

test('validateLeadPayload rejects out-of-range investAmount', () => {
  const tooHigh = validateLeadPayload({
    vertical: 'Mutual Fund', category: 'Equity Funds', planName: 'Large Cap Fund',
    actionType: 'Official Brochure', investAmount: '99999999999',
  });
  assert.equal(tooHigh.valid, false);

  const negative = validateLeadPayload({
    vertical: 'Mutual Fund', category: 'Equity Funds', planName: 'Large Cap Fund',
    actionType: 'Official Brochure', investAmount: '-500',
  });
  assert.equal(negative.valid, false);
});

test('validateLeadPayload rejects out-of-range tenure', () => {
  const result = validateLeadPayload({
    vertical: 'Health Insurance', category: 'Individual Cover', planName: 'Star Comprehensive',
    actionType: 'Request Quote', tenure: '999',
  });
  assert.equal(result.valid, false);
  assert.match(result.error, /tenure must be/);
});

test('validateLeadPayload allows omitted optional numeric fields', () => {
  const result = validateLeadPayload({
    vertical: 'Motor Insurance', category: 'Two Wheeler', planName: 'Third-Party Liability Policy',
    actionType: 'Official Brochure',
  });
  assert.equal(result.valid, true);
  assert.equal(result.data.investAmount, null);
  assert.equal(result.data.tenure, null);
});
