// Run with: npm run seed
// Creates one demo institute and one demo student so you can log in
// immediately without going through admin/signup flows.

const bcrypt = require("bcryptjs");
const store = require("./store");

function seed() {
  let institute = store.getInstituteByCode("DEMO123");
  if (!institute) {
    institute = store.createInstitute({
      name: "Horizon Coaching Institute",
      code: "DEMO123", // students enter this to reach the right white-label portal
      brandColor: "#4f46e5",
      logoText: "Horizon",
    });
    console.log(`Created institute: ${institute.name} (code: ${institute.code})`);
  } else {
    console.log(`Institute already exists: ${institute.name}`);
  }

  const email = "riya@example.com";
  let student = store.getStudentByEmail(institute.id, email);
  if (!student) {
    const passwordHash = bcrypt.hashSync("password123", 10);
    student = store.createStudent({
      instituteId: institute.id,
      name: "Riya Sharma",
      email,
      passwordHash,
      class: "10",
      board: "CBSE",
      exam: "Board Exams",
    });
    console.log(`Created student: ${student.name} (${student.email} / password123)`);

    // Give the demo student a bit of learning history so the
    // "gets smarter over time" behavior is visible immediately.
    store.updateProfile(student.id, (profile) => {
      profile.learningStyle = "example-first";
      profile.strengths = ["Linear Equations", "Basic Trigonometry"];
      profile.weaknesses = ["Quadratic Equations", "Trigonometric Identities"];
      profile.completedTopics = [
        {
          subject: "Math",
          topic: "Linear Equations",
          confidence: "high",
          completedAt: new Date(Date.now() - 7 * 86400000).toISOString(),
        },
      ];
      profile.topicMastery = {
        "Math::Linear Equations": { attempts: 6, correct: 5, confidence: 0.83, lastSeen: new Date().toISOString() },
        "Math::Quadratic Equations": { attempts: 4, correct: 1, confidence: 0.25, lastSeen: new Date().toISOString() },
      };
      return profile;
    });
  } else {
    console.log(`Student already exists: ${student.email}`);
  }

  console.log("\nLogin at http://localhost:3000 with:");
  console.log(`  Institute code: ${institute.code}`);
  console.log(`  Email: ${email}`);
  console.log(`  Password: password123`);
}

if (require.main === module) {
  seed();
}

module.exports = { seed };

