/* ============================================================
   Starting data — do not modify
   ============================================================ */
let notes = [
  { id: 1, text: "Buy milk and bread", category: "personal" },
  { id: 2, text: "Finish the Day 3 assignment", category: "study" },
  { id: 3, text: "Email the project report to Grace", category: "work" },
  { id: 4, text: "Revise JavaScript arrays", category: "study" },
  { id: 5, text: "Call mum", category: "personal" },
];

/* ============================================================
   1. searchNotes(word)
      Returns an array of notes whose text contains word
      (case-insensitive).
   ============================================================ */
function searchNotes(word) {
  const term = word.toLowerCase();
  return notes.filter(note => note.text.toLowerCase().includes(term));
}

console.log("searchNotes('buy'):", JSON.stringify(searchNotes("buy")));
// Expected: [{"id":1,"text":"Buy milk and bread","category":"personal"}]

console.log("searchNotes('xyz'):", JSON.stringify(searchNotes("xyz")));
// Expected: []

console.log("searchNotes('MILK'):", JSON.stringify(searchNotes("MILK")));
// Expected: [{"id":1,"text":"Buy milk and bread","category":"personal"}]


/* ============================================================
   2. longestNote()
      Returns the note object with the most characters,
      or null if the notes array is empty.
   ============================================================ */
function longestNote() {
  if (notes.length === 0) return null;

  let longest = notes[0];
  for (let i = 1; i < notes.length; i++) {
    if (notes[i].text.length > longest.text.length) {
      longest = notes[i];
    }
  }
  return longest;
}

console.log("longestNote():", JSON.stringify(longestNote()));
// Expected: {"id":3,"text":"Email the project report to Grace","category":"work"}

// Simulate empty array for edge case
let emptyNotes = [];
function longestNoteEmpty() {
  if (emptyNotes.length === 0) return null;
  let longest = emptyNotes[0];
  for (let i = 1; i < emptyNotes.length; i++) {
    if (emptyNotes[i].text.length > longest.text.length) {
      longest = emptyNotes[i];
    }
  }
  return longest;
}
console.log("longestNote() on empty:", longestNoteEmpty());
// Expected: null


/* ============================================================
   3. countByCategory()
      Returns an object counting notes per category.
      Example: { personal: 2, work: 1, study: 2 }
   ============================================================ */
function countByCategory() {
  const counts = {};
  for (let i = 0; i < notes.length; i++) {
    const cat = notes[i].category;
    if (counts[cat]) {
      counts[cat]++;
    } else {
      counts[cat] = 1;
    }
  }
  return counts;
}

console.log("countByCategory():", JSON.stringify(countByCategory()));
// Expected: {"personal":2,"study":2,"work":1}


/* ============================================================
   4. getSummary()
      Returns a sentence like:
      "5 notes: 2 personal, 1 work, 2 study."
      Uses singular "note" when total is 1.
   ============================================================ */
function getSummary() {
  const counts = countByCategory();
  let total = 0;
  for (const cat in counts) {
    total += counts[cat];
  }

  const word = total === 1 ? "note" : "notes";
  const parts = [];
  for (const cat in counts) {
    parts.push(`${counts[cat]} ${cat}${counts[cat] === 1 ? "" : ""}`);
  }

  return `${total} ${word}: ${parts.join(", ")}.`;
}

console.log("getSummary():", getSummary());
// Expected: "5 notes: 2 personal, 2 study, 1 work."


/* ============================================================
   5. isDuplicate(text)
      Returns true if a note with the same text already exists,
      ignoring case and extra leading/trailing spaces.
   ============================================================ */
function isDuplicate(text) {
  const trimmed = text.trim().toLowerCase();
  return notes.some(note => note.text.trim().toLowerCase() === trimmed);
}

console.log("isDuplicate('Call mum'):", isDuplicate("Call mum"));
// Expected: true

console.log("isDuplicate('  call MUM  '):", isDuplicate("  call MUM  "));
// Expected: true

console.log("isDuplicate('Buy milk and bread'):", isDuplicate("Buy milk and bread"));
// Expected: true

console.log("isDuplicate('Go for a run'):", isDuplicate("Go for a run"));
// Expected: false


/* ============================================================
   6. addNote(text, category)
      Adds a note only if:
        - text is between 1 and 200 characters
        - it is not a duplicate
        - category is one of: personal, work, study
      Returns true when added, false otherwise.
      Logs the reason for rejection.
   ============================================================ */
function addNote(text, category) {
  const validCategories = ["personal", "work", "study"];

  // Check category
  if (!validCategories.includes(category)) {
    console.log(`Rejected: invalid category "${category}"`);
    return false;
  }

  // Check length (1–200 characters)
  if (text.length < 1 || text.length > 200) {
    console.log(`Rejected: text length ${text.length} is out of range (1-200)`);
    return false;
  }

  // Check duplicate
  if (isDuplicate(text)) {
    console.log("Rejected: duplicate note");
    return false;
  }

  // All checks passed — add the note
  const newId = notes.length > 0 ? Math.max(...notes.map(n => n.id)) + 1 : 1;
  notes.push({ id: newId, text: text, category: category });
  console.log(`Added note #${newId}: "${text}" (${category})`);
  return true;
}

console.log("addNote('Buy groceries', 'personal'):", addNote("Buy groceries", "personal"));
// Expected: true — note added

console.log("addNote('Buy milk and bread', 'personal'):", addNote("Buy milk and bread", "personal"));
// Expected: false — duplicate

console.log("addNote('', 'personal'):", addNote("", "personal"));
// Expected: false — empty text

console.log("addNote('A very long note that exceeds the two hundred character limit because this string is deliberately crafted to be longer than two hundred characters in total length here', 'personal'):", addNote("A very long note that exceeds the two hundred character limit because this string is deliberately crafted to be longer than two hundred characters in total length here", "personal"));
// Expected: false — too long

console.log("addNote('New idea', 'finance'):", addNote("New idea", "finance"));
// Expected: false — invalid category

console.log("addNote('Plan weekend trip', 'study'):", addNote("Plan weekend trip", "study"));
// Expected: true — note added
