# Proteccion recomendada para `main`

1. Ejecutar el workflow `CI` al menos una vez en GitHub para que sus checks queden registrados.
2. Ir a `Settings > Branches > Add branch protection rule` (o `Settings > Rules > Rulesets > New branch ruleset`).
3. Usar el patron de rama `main`.
4. Activar `Require a pull request before merging`.
5. Activar `Require status checks to pass before merging` y seleccionar:
   - `CI / Backend tests`
   - `CI / Frontend tests`
   - `CI / Lint`
6. Activar `Require branches to be up to date before merging`.
7. Desactivar bypass para administradores si se quiere que el smoke de `main` sea obligatorio para todos.

El check minimo solicitado es `CI / Backend tests`. Se recomiendan los tres para evitar que un PR con backend verde pero frontend roto llegue a `main`.

El push a `main` vuelve a ejecutar los tres jobs como smoke final. El deploy de Render debe depender de que termine este workflow o mantener desactivado el auto-deploy directo por push; GitHub no puede convertir un check posterior al push en una barrera para un deploy que Render ya inicio.
