const loadBtn = document.getElementById("load-users");
const filterInput = document.getElementById("filter-input");
const statusEl = document.getElementById("status");
const usersList = document.getElementById("users-list");

const API_URL = "https://jsonplaceholder.typicode.com/users";

let allUsers = [];

function renderUsers(list) {
  usersList.innerHTML = "";

  if (list.length === 0) {
    statusEl.textContent = "No users match your filter.";
    return;
  }

statusEl.textContent = `${list.length} user(s) found.`;

  list.forEach((user) => {
    const li = document.createElement("li");
    const name = document.createElement("strong");
    name.textContent = user.name;
    const email = document.createElement("span");
    email.textContent = ` — ${user.email}`;
    const details = document.createElement("div");
    details.textContent = `City: ${user.address.city} | Company: ${user.company.name}`;
    li.append(name, email, details);
    usersList.appendChild(li);
  });
}

async function loadUsers() {
  loadBtn.disabled = true;
  statusEl.textContent = "Loading...";

  try {
    const response = await fetch(API_URL);

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    allUsers = await response.json();
    renderUsers(allUsers);

    statusEl.textContent = `Loaded ${allUsers.length} users.`;
    filterInput.disabled = false;
  } catch (error) {
    statusEl.textContent = `Error: ${error.message}`;
  } finally {
    loadBtn.disabled = false;
  }
}

loadBtn.addEventListener("click", loadUsers);

filterInput.addEventListener("input", () => {
  const query = filterInput.value.trim().toLowerCase();

  const filtered = allUsers.filter((user) =>
    user.name.toLowerCase().includes(query)
  );

  renderUsers(filtered);
});
