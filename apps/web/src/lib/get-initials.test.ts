import { getInitials } from "./get-initials"

describe("getInitials", () => {
  it("returns first and last initials for multi-word names", () => {
    expect(getInitials("John Doe")).toBe("JD")
    expect(getInitials("Alice Bob Charlie")).toBe("AC")
  })

  it("uses email segments when name is single word", () => {
    expect(getInitials("John", "john.doe@example.com")).toBe("JD")
    expect(getInitials("J", "jane_smith@example.com")).toBe("JS")
  })

  it("falls back to first two chars of name", () => {
    expect(getInitials("John")).toBe("JO")
  })

  it("falls back to first two chars of email local part", () => {
    expect(getInitials("", "ab@example.com")).toBe("AB")
  })

  it("returns ?? when no usable input", () => {
    expect(getInitials("")).toBe("??")
    expect(getInitials("   ")).toBe("??")
    expect(getInitials("", "a@x.com")).toBe("??")
  })

  it("handles whitespace-only names with email fallback", () => {
    expect(getInitials("  ", "first.last@example.com")).toBe("FL")
  })

  it("uppercases all results", () => {
    expect(getInitials("jane doe")).toBe("JD")
  })
})
