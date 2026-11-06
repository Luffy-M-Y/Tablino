const command = process.argv[2];

if (command === "push") {
  console.error("db:push est interdit. Utilisez une migration approuvée.");
} else if (command === "studio") {
  console.error("db:studio est désactivé dans ce dépôt.");
} else {
  console.error("Commande base non autorisée.");
}

process.exitCode = 1;
