import { expect } from 'chai';

describe("Basic Tests", function () {
  it("should pass a simple assertion", function () {
    expect(true).to.be.true;
  });
  
  it("should handle basic math", function () {
    expect(1 + 1).to.equal(2);
    expect(5 * 5).to.equal(25);
  });
  
  it("should handle string operations", function () {
    expect("hello" + " world").to.equal("hello world");
    expect("test".length).to.equal(4);
  });
}); 