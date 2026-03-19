import { describe, expect, it } from "vitest"
import {
  asOptionalString,
  buildAcceptInviteUrl,
  isRecord,
  isWorkspaceType,
  validateWorkspaceFields,
} from "./auth-workspace.server"

describe("isRecord", () => {
  it("returns true for plain objects", () => {
    expect(isRecord({})).toBe(true)
    expect(isRecord({ a: 1 })).toBe(true)
  })

  it("returns true for arrays (typeof object)", () => {
    expect(isRecord([1, 2])).toBe(true)
  })

  it.each([null, undefined, "string", 42, true])(
    "returns false for %j",
    (value) => {
      expect(isRecord(value)).toBe(false)
    }
  )
})

describe("isWorkspaceType", () => {
  it.each(["personal", "workspace"])(
    'returns true for valid type "%s"',
    (type) => {
      expect(isWorkspaceType(type)).toBe(true)
    }
  )

  it.each(["other", "", null, undefined, 42])(
    "returns false for invalid value %j",
    (value) => {
      expect(isWorkspaceType(value)).toBe(false)
    }
  )
})

describe("asOptionalString", () => {
  it("returns the string for non-empty strings", () => {
    expect(asOptionalString("hello")).toBe("hello")
  })

  it.each(["", null, undefined, 42, true])(
    "returns undefined for %j",
    (value) => {
      expect(asOptionalString(value)).toBeUndefined()
    }
  )
})

describe("validateWorkspaceFields", () => {
  describe("create context", () => {
    it("accepts valid personal workspace", () => {
      expect(() =>
        validateWorkspaceFields(
          { workspaceType: "personal", personalOwnerUserId: "user_1" },
          "create"
        )
      ).not.toThrow()
    })

    it("accepts valid standard workspace", () => {
      expect(() =>
        validateWorkspaceFields({ workspaceType: "workspace" }, "create")
      ).not.toThrow()
    })

    it("throws when workspaceType is missing", () => {
      expect(() => validateWorkspaceFields({}, "create")).toThrow(
        "workspaceType is required"
      )
    })

    it("throws for invalid workspaceType", () => {
      expect(() =>
        validateWorkspaceFields({ workspaceType: "invalid" }, "create")
      ).toThrow("workspaceType must be personal or workspace")
    })

    it("throws when personal workspace lacks personalOwnerUserId", () => {
      expect(() =>
        validateWorkspaceFields({ workspaceType: "personal" }, "create")
      ).toThrow("personalOwnerUserId is required for personal workspaces")
    })
  })

  describe("update context", () => {
    it("allows missing workspaceType", () => {
      expect(() => validateWorkspaceFields({}, "update")).not.toThrow()
    })

    it("throws for invalid workspaceType", () => {
      expect(() =>
        validateWorkspaceFields({ workspaceType: "bad" }, "update")
      ).toThrow("workspaceType must be personal or workspace")
    })

    it("throws when personalOwnerUserId is set on standard workspace", () => {
      expect(() =>
        validateWorkspaceFields(
          {
            workspaceType: "workspace",
            personalOwnerUserId: "user_1",
          },
          "update"
        )
      ).toThrow("personalOwnerUserId is not allowed for workspace type")
    })
  })
})

describe("buildAcceptInviteUrl", () => {
  it("uses provided baseUrl", () => {
    expect(buildAcceptInviteUrl("https://app.example.com", "inv_123")).toBe(
      "https://app.example.com/accept-invite?id=inv_123"
    )
  })

  it("removes trailing slash from origin", () => {
    expect(buildAcceptInviteUrl("https://app.example.com/", "inv_123")).toBe(
      "https://app.example.com/accept-invite?id=inv_123"
    )
  })

  it("falls back to localhost when baseUrl is empty", () => {
    expect(buildAcceptInviteUrl("  ", "inv_123")).toBe(
      "http://localhost:3000/accept-invite?id=inv_123"
    )
  })

  it("falls back to localhost when baseUrl is empty string", () => {
    expect(buildAcceptInviteUrl("", "inv_123")).toBe(
      "http://localhost:3000/accept-invite?id=inv_123"
    )
  })

  it("encodes special characters in invitationId", () => {
    expect(buildAcceptInviteUrl("http://localhost:3000", "a&b=c")).toBe(
      "http://localhost:3000/accept-invite?id=a%26b%3Dc"
    )
  })
})
