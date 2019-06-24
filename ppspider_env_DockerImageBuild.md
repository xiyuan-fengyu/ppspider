# ppspider_env docker镜像构建过程  
ppspider_env 是一个基于 centos 的部署运行环境，包括 chromium 相关依赖，nodejs(typescript, yarn)，git，wget, ifconfig，mongodb，ssh   
镜像已提交到docker官方仓库，之后用户可以直接使用，这里只是记录一下镜像的构建过程      

```bash
# 构建一个临时容器，在其上构建 ppspider 运行环境
docker login -u xiyuanfengyu -p *****************
docker run -it --network=host --name ppspider_env_temp centos

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
    && npm install -g typescript \
    && npm install -g yarn \
    && yum -y install git \
    && yum -y install wget \
    && yum -y install net-tools
    
    
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
sed -i 's/  bindIp: 127.0.0.1/  bindIp: 0.0.0.0/g' /etc/mongod.conf

yum -y install openssh-server
sed -i 's/#Port 22/Port 22/g' /etc/ssh/sshd_config
sed -i 's/#PermitRootLogin yes/PermitRootLogin yes/g' /etc/ssh/sshd_config
systemctl enable sshd


# ctrl+p, ctrl + q 返回 docker host，commit镜像，push镜像
docker commit ppspider_env_temp docker.io/xiyuanfengyu/ppspider_env
docker stop ppspider_env_temp && docker rm ppspider_env_temp
docker push docker.io/xiyuanfengyu/ppspider_env

```
