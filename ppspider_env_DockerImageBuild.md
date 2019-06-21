# ppspider_env docker镜像构建过程  
镜像正在提交到docker官方仓库，之后用户可以直接使用，这里只是记录一下镜像的构建过程      
ppspider_env docker镜像构建过程，包括 chromium 相关依赖，nodejs(typescript, yarn)，git，mongodb 的安装过程      

```bash
# 构建一个临时容器，在其上构建 ppspider 运行环境
docker login -u xiyuanfengyu -p *****************
docker run -it --name ppspider_env_temp centos

# 进入 container 后，搭建环境
yum -y install epel-release \
    && yum -y install libX11 \
    && yum -y install libXcomposite \
    && yum -y install libXcursor \
    && yum -y install libXdamage \
    && yum -y install libXext \
    && yum -y install libXi \
    && yum -y install libXtst \
    && yum -y install cups-libs \
    && yum -y install libXScrnSaver \
    && yum -y install libXrandr \
    && yum -y install alsa-lib \
    && yum -y install atk \
    && yum -y install at-spi2-atk \
    && yum -y install pango \
    && yum -y install gtk3 \
    && yum -y groupinstall Fonts \
    && yum -y install nodejs \
    && yum -y install git \
    && npm install -g typescript \
    && npm install -g yarn 
    
echo -e '
[mongodb-org-4.0]
name=MongoDB Repository
baseurl=https://repo.mongodb.org/yum/redhat/$releasever/mongodb-org/4.0/x86_64/
gpgcheck=1
enabled=1
gpgkey=https://www.mongodb.org/static/pgp/server-4.0.asc
' > /etc/yum.repos.d/mongodb-org-4.0.repo
yum -y install mongodb-org
systemctl enable mongod
echo "bind_ip=0.0.0.0" > /etc/mongodb.conf

# ctrl+p, ctrl + q 返回 docker host，commit镜像，push镜像
docker commit ppspider_env_temp xiyuanfengyu/ppspider_env
docker push xiyuanfengyu/ppspider_env

```
