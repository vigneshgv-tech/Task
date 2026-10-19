const crypto = require("crypto");
const { promisify } = require("util");
const { User, sequelize } = require("../models");
const { createRider } = require("./riderService");

const scrypt = promisify(crypto.scrypt);
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14;
const sessionSecret =
  process.env.AUTH_TOKEN_SECRET || "relay-local-development-token-secret";

async function hashPassword(
  password,
  salt = crypto.randomBytes(16).toString("hex"),
) {
  const derivedKey = await scrypt(password, salt, 64);
  return { salt, hash: derivedKey.toString("hex") };
}

async function verifyPassword(password, salt, storedHash) {
  const { hash } = await hashPassword(password, salt);
  const expected = Buffer.from(storedHash, "hex");
  const actual = Buffer.from(hash, "hex");
  return (
    expected.length === actual.length &&
    crypto.timingSafeEqual(actual, expected)
  );
}

function serializeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    rider_id: user.riderId,
  };
}

function createSessionToken(user) {
  const payload = Buffer.from(
    JSON.stringify({
      sub: user.id,
      exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
    }),
  ).toString("base64url");
  const signature = crypto
    .createHmac("sha256", sessionSecret)
    .update(payload)
    .digest("base64url");
  return `${payload}.${signature}`;
}

async function getUserFromSessionToken(token) {
  const [payload, suppliedSignature, extra] = String(token || "").split(".");
  if (!payload || !suppliedSignature || extra) return null;

  const expectedSignature = crypto
    .createHmac("sha256", sessionSecret)
    .update(payload)
    .digest();
  let actualSignature;
  try {
    actualSignature = Buffer.from(suppliedSignature, "base64url");
  } catch {
    return null;
  }
  if (
    actualSignature.length !== expectedSignature.length ||
    !crypto.timingSafeEqual(actualSignature, expectedSignature)
  ) {
    return null;
  }

  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (!claims.sub || claims.exp <= Math.floor(Date.now() / 1000)) return null;
    const user = await User.findByPk(claims.sub);
    return user ? serializeUser(user) : null;
  } catch {
    return null;
  }
}

async function registerUser(payload) {
  const email = String(payload.email || "")
    .trim()
    .toLowerCase();
  const name = String(payload.name || "").trim();
  const role = String(payload.role || "").toLowerCase();
  if (!name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw Object.assign(new Error("Enter a valid name and email address"), {
      statusCode: 400,
    });
  }
  if (!payload.password || String(payload.password).length < 8) {
    throw Object.assign(new Error("Password must be at least 8 characters"), {
      statusCode: 400,
    });
  }
  if (!["dispatcher", "rider"].includes(role)) {
    throw Object.assign(new Error("Choose a valid account role"), {
      statusCode: 400,
    });
  }
  if (await User.findOne({ where: { email } })) {
    throw Object.assign(
      new Error("An account with that email already exists"),
      { statusCode: 409 },
    );
  }
  const { salt, hash } = await hashPassword(String(payload.password));
  return sequelize.transaction(async (transaction) => {
    const rider =
      role === "rider"
        ? await createRider(
            {
              name,
              current_zone: "central",
              supported_zones: [],
              total_capacity: 0,
              available_capacity: 0,
              current_workload: 0,
              availability_status: "UNAVAILABLE",
            },
            { transaction },
          )
        : null;
    const user = await User.create(
      {
        name,
        email,
        passwordHash: hash,
        passwordSalt: salt,
        role,
        riderId: rider?.id || null,
      },
      { transaction },
    );
    return {
      user: serializeUser(user),
      rider,
      token: createSessionToken(user),
    };
  });
}

async function loginUser(payload) {
  const email = String(payload.email || "")
    .trim()
    .toLowerCase();
  const user = await User.findOne({ where: { email } });
  if (
    !user ||
    !(await verifyPassword(
      String(payload.password || ""),
      user.passwordSalt,
      user.passwordHash,
    ))
  ) {
    throw Object.assign(new Error("Invalid email or password"), {
      statusCode: 401,
    });
  }
  return {
    user: serializeUser(user),
    token: createSessionToken(user),
  };
}

module.exports = {
  registerUser,
  loginUser,
  getUserFromSessionToken,
  createSessionToken,
  hashPassword,
  verifyPassword,
};
