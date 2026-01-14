---
title: "Deploying Ruby on Rails with Kamal Next to Coolify"
description: "I have a VPS with Coolify on. Recently I was learning Ruby on Rails and wanted to deploy a small application with Kamal to the same server. Because Coolify uses Traefik in the background, it&#8217;s n"
date: 2025-12-04
modified: 2025-12-05
featured: ./featured.png
featuredAlt: ""
draft: false
---

I have a VPS with Coolify on. Recently I was learning Ruby on Rails and wanted to deploy a small application with Kamal to the same server. Because Coolify uses Traefik in the background, it’s not completely trivial. Next, I explain what you have to do.

Kamal always needs a so-called Registry ([Kamal – Registry](https://kamal-deploy.org/docs/configuration/docker-registry/)). I am using Docker Hub (it is very easy to use). If you also want to use Docker Hub, you first need to create and account and get an access token. Then, you need to save this access token as an environment variable on your local machine. Depending on your operating system, you will put something like this into your bashrc/zshrc/etc. :

export KAMAL\_REGISTRY\_PASSWORD="your-access-token"

Then, you need to refer to this env variable in the .kamal/secrets file of your project:

KAMAL\_REGISTRY\_PASSWORD=$KAMAL\_REGISTRY\_PASSWORD

Setup a DNS that points to your (sub) domain where you want your project to run. If using Cloudflare, initially set the record to “DNS only” (not proxied), this seems to be important for TLS certificate generation.

A record: app.yourdomain.com -> YOUR\_VPS\_IP

Now, you finally need to edit your `config/deploy.yml`. I have annotated all necessary changes with TODO.

\# TODO: change this to your app name
service: appname 

# TODO: Name of the container image (use your-user/app-name on external registries).
image: username/appname

# Deploy to these servers.
servers:
  web:
    hosts:
      - 192.168.42.230 # TODO: change to your VPS IP address
    proxy: false
    options:
      network: "coolify"

labels:
  traefik.enable: "true"
  traefik.docker.network: "coolify"
  traefik.http.routers.store-https.rule: "Host(\`app.example.com\`)" # TODO: change to your domain
  traefik.http.routers.store-https.entrypoints: "https"
  traefik.http.routers.store-https.tls: "true"
  traefik.http.routers.store-https.tls.certresolver: "letsencrypt"
  traefik.http.routers.store-https.service: "appname" # TODO: change
  traefik.http.services.store.loadbalancer.server.port: "3000"
  traefik.http.routers.store-http.rule: "Host(\`app.example.com\`)" # TODO: change
  traefik.http.routers.store-http.entrypoints: "http"
  traefik.http.routers.store-http.middlewares: "redirect-to-https"

# Where you keep your container images.
registry:
  # Alternatives: hub.docker.com / registry.digitalocean.com / ghcr.io / ...
  username: yourusername # TODO: change
  password:
    - KAMAL\_REGISTRY\_PASSWORD # this is an environment variable which contains the access token

env:
  secret:
    - RAILS\_MASTER\_KEY
  clear:
    SOLID\_QUEUE\_IN\_PUMA: true

aliases:
  console: app exec --interactive --reuse "bin/rails console"
  shell: app exec --interactive --reuse "bash"
  logs: app logs -f
  dbc: app exec --interactive --reuse "bin/rails dbconsole --include-password"

volumes:
  - "store\_storage:/rails/storage"

asset\_path: /rails/public/assets

builder:
  arch: arm64 # TODO: change to amd64 if your VPS uses x86\_64 architecture

For you understanding, the two most important things (to make kamal work next to Coolify) are:

-   We disable Kamal’s proxy with `proxy: false`
-   We do not have any port publishing (`publish:` option is skipped), because Docker + Traefik handle that for us
-   We specify the entrypoint `http` and `https`, those are used by Coolify

Now to actually deploy your app, run `bin/kamal setup`. For all subsequent deployments you then use `bin/kamal deploy`.

_Note: Kamal always just deploys the changes that you have committed with git!_
