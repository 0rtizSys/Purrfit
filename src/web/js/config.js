// Contenido estático de la landing (respaldo: la lista real sale de /api/commands).
// El bot usa comandos con PREFIJO (por defecto $>); solo /help, /dashboard y /support son de barra. Los links y la invitación NO van aquí:
// salen de .env vía /api/config (CLIENT_ID, SUPPORT_URL, CONTACT_EMAIL...).
window.PURRFIT = {
    COINS_LIST: [
        { name: "Purrcoin", sym: "PURR" },
        { name: "Meowthereum", sym: "MEOW" },
        { name: "Whisker Token", sym: "WSK" },
        { name: "Catnip", sym: "NIP" },
        { name: "Tuna Stable", sym: "TUNA" },
    ],
    COMMANDS: [
        {
            cat: "Economía",
            name: "$>work",
            desc: "Gana una recompensa aleatoria (100 a 1000).",
        },
        { cat: "Economía", name: "$>wallet_balance", desc: "Mira tu cartera." },
        {
            cat: "Economía",
            name: "$>bank_balance",
            desc: "Mira tu saldo en el banco.",
        },
        {
            cat: "Economía",
            name: "$>deposit",
            desc: "Mueve dinero de la cartera al banco.",
        },
        {
            cat: "Economía",
            name: "$>withdraw",
            desc: "Mueve dinero del banco a la cartera.",
        },
        {
            cat: "Economía",
            name: "$>transfer",
            desc: "Envía dinero a otro miembro (con impuesto del servidor).",
        },
        {
            cat: "Economía",
            name: "$>leaderboard",
            desc: "Top 10 de los más ricos.",
        },
        {
            cat: "Economía",
            name: "$>economy_info",
            desc: "Símbolo, cooldown, impuestos, interés y tesorería.",
        },
        {
            cat: "Cripto",
            name: "$>crypto market",
            desc: "Precios actuales y cambio en 24h.",
        },
        {
            cat: "Cripto",
            name: "$>crypto chart",
            desc: "Gráfica de precio: 1h, 24h, 7d o 30d.",
        },
        {
            cat: "Cripto",
            name: "$>crypto buy",
            desc: "Compra una moneda con tu cartera.",
        },
        {
            cat: "Cripto",
            name: "$>crypto sell",
            desc: "Vende parte o todo lo que tengas.",
        },
        {
            cat: "Cripto",
            name: "$>crypto portfolio",
            desc: "Tus monedas, su valor y lo que pagaste.",
        },
        { cat: "Juegos", name: "$>coinflip", desc: "Apuesta a cara o cruz." },
        {
            cat: "Admin",
            name: "$>add_balance",
            desc: "Añade dinero a un miembro.",
        },
        {
            cat: "Admin",
            name: "$>set_cooldown_time",
            desc: "Cooldown de $>work en segundos.",
        },
        {
            cat: "Admin",
            name: "$>set_economy_symbol",
            desc: "Símbolo de la moneda (1 o 2 caracteres).",
        },
        { cat: "Admin", name: "$>set_tax_rate", desc: "Impuesto de 0 a 50%." },
        {
            cat: "Admin",
            name: "$>set_interest_rate",
            desc: "Interés bancario diario de 0 a 5%.",
        },
        {
            cat: "Utilidad",
            name: "/help",
            desc: "Lista de comandos y enlaces (comando de barra).",
        },
        {
            cat: "Utilidad",
            name: "/dashboard",
            desc: "Abre el panel web (comando de barra).",
        },
        {
            cat: "Utilidad",
            name: "/support",
            desc: "Enlace al servidor de soporte (comando de barra).",
        },
        {
            cat: "Utilidad",
            name: "$>prefix",
            desc: "Muestra el prefijo del servidor o lo cambia (admins).",
        },
        { cat: "Utilidad", name: "$>ping", desc: "Latencia del bot." },
        {
            cat: "Utilidad",
            name: "$>delete_my_data",
            desc: "Borra tus datos en todos los servidores.",
        },
    ],
};
