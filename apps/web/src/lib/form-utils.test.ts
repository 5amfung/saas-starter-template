import { toFieldErrorItem } from "./form-utils"

describe("toFieldErrorItem", () => {
  it("wraps string errors in an object", () => {
    expect(toFieldErrorItem("Something failed")).toEqual({
      message: "Something failed",
    })
  })

  it("passes through objects with message property", () => {
    const error = { message: "Already exists" }
    expect(toFieldErrorItem(error)).toBe(error)
  })

  it("returns generic message for unknown error types", () => {
    expect(toFieldErrorItem(42)).toEqual({ message: "Validation error." })
    expect(toFieldErrorItem(null)).toEqual({ message: "Validation error." })
    expect(toFieldErrorItem(undefined)).toEqual({
      message: "Validation error.",
    })
  })
})
